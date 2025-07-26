import { Context, h, Schema } from "koishi";
import { HourlyType } from "./model";
import { CityNotFoundError, Weather } from "./weather_data";
import * as path from "path";
import { add_date, add_hour_data, add_tag_color } from "./utils";
import {} from "koishi-plugin-html-renderer/src";

export const name = "heweather";
export const inject = ["html_renderer", "database"];

export interface Config {
    timezone: string;
    qweather_apihost: string;
    qweather_apitype: 0 | 1 | 2;
    qweather_hourlytype: HourlyType;
    qweather_forecast_days: number;
    qweather_use_jwt?: boolean;
    qweather_jwt_sub?: string;
    qweather_apikey?: string;
    qweather_jwt_private_key?: string;
    qweather_jwt_kid?: string;
}

export const Config: Schema<Config> = Schema.object({
    timezone: Schema.string().default("Asia/Shanghai").description("时区"),
    qweather_apihost: Schema.string().description("API Host").default("https://api.qweather.com"),
    qweather_apitype: Schema.union([
        Schema.const(0).description("免费订阅 (3-7 天天气预报)"),
        Schema.const(1).description("标准订阅 (3-30 天天气预报)"),
        Schema.const(2).description("高级订阅 (3-30 天天气预报)")
    ])
        .description("API 类型")
        .default(0),
    qweather_hourlytype: Schema.union([
        Schema.const(HourlyType.current_12h).description("当前12小时"),
        Schema.const(HourlyType.current_24h).description("当前24小时")
    ])
        .description("小时天气类型")
        .default(HourlyType.current_12h),
    qweather_forecast_days: Schema.number().min(3).max(30).description("预报天数").default(3),

    qweather_use_jwt: Schema.boolean().description("是否使用 JWT (官方推荐，仅标准和高级订阅可用)").default(true),

    qweather_apikey: Schema.string().description("API Key (非JWT模式使用)").role("secret"),
    qweather_jwt_sub: Schema.string().description("控制台中的项目管理的项目ID (仅JWT模式)"),
    qweather_jwt_kid: Schema.string().description("控制台上传公钥后获取，凭据 ID (仅JWT模式)"),
    qweather_jwt_private_key: Schema.string().description("JWT 私钥文本 (仅JWT模式)").role("textarea")
});

export async function apply(ctx: Context, config: Config) {
    ctx.on("message", async (session) => {
        if (!session || !session.content) {
            return;
        }
        if (session.guildId) {
            const targetChannels = await ctx.database.get("channel", {
                id: session.guildId,
                platform: session.platform
            });
            if (targetChannels.length === 0) {
                return;
            }
            if (targetChannels[0].assignee !== session.selfId) {
                return;
            }
        }

        const match = session.content.match(/^(.+?)天气\s*$|^天气(.+?)\s*$/);
        if (match) {
            const location = (match[1] || match[2] || "").trim();
            if (!location) {
                await session.send("请输入一个有效的地点");
                return;
            }
            await session.execute(`heweather ${location}`);
        }
    });

    ctx.command("heweather <location:text>", "查询天气信息")
        .alias("天气")
        .action(async ({ session }, location) => {
            if (!session) {
                throw new Error("无法获取会话信息");
            }
            if (location) {
                await session.send(`查询 ${location} 的天气信息...`);
                if (!(config.qweather_apikey || config.qweather_use_jwt)) {
                    throw new Error("请配置 API Key 或启用 JWT 模式");
                }
                const w_data: Weather = new Weather(location, config);
                try {
                    await w_data.load();
                } catch (error) {
                    if (error instanceof CityNotFoundError) {
                        await session.send(`未找到城市: ${location}`);
                        return;
                    }
                    await session.send("查询天气信息失败");
                    throw error;
                }
                let air = null;
                if (w_data.air && w_data.air.now) {
                    air = add_tag_color(w_data.air.now);
                }

                const templateDir = path.resolve(__dirname, "templates");
                const image = await ctx.html_renderer.render_template_html_file(
                    templateDir,
                    "weather.ejs",
                    {
                        now: w_data.now.now,
                        days: add_date(w_data.daily.daily),
                        city: w_data.cityName,
                        warning: w_data.warning,
                        air: air,
                        hours: add_hour_data(w_data.hourly.hourly, config.qweather_hourlytype, config.timezone)
                    },
                    {
                        viewport: { width: 1000, height: 1250 },
                        base_url: `file://${templateDir}`
                    }
                );
                await session.send(h.image(image, "image/png"));
            }
        });
}

import moent from "moment-timezone";
import { Air, Hourly, HourlyType } from "./model";
import { ConfigError } from "./weather_data";
import { importPKCS8, SignJWT } from "jose";

export interface JwtConfig {
    qweather_jwt_sub: string;
    qweather_jwt_kid: string;
    qweather_jwt_private_key: string;
}

export async function getJwtToken(config: JwtConfig): Promise<string> {
    const { qweather_jwt_sub, qweather_jwt_kid, qweather_jwt_private_key } = config;

    if (!qweather_jwt_sub || !qweather_jwt_kid || !qweather_jwt_private_key) {
        throw new ConfigError("Missing required JWT configuration parameters");
    }

    const payload = {
        iat: Math.floor(Date.now() / 1000) - 30,
        exp: Math.floor(Date.now() / 1000) + 900,
        sub: qweather_jwt_sub
    };

    const header = {
        alg: "EdDSA",
        kid: qweather_jwt_kid
    };

    const key = await importPKCS8(qweather_jwt_private_key, "EdDSA");

    return await new SignJWT({})
        .setProtectedHeader({ alg: "EdDSA", kid: qweather_jwt_kid })
        .setIssuedAt(payload.iat)
        .setExpirationTime(payload.exp)
        .setSubject(payload.sub)
        .sign(key);
}
export function add_tag_color(air: Air): Air {
    const color: { [key: string]: string } = {
        优: "#95B359",
        良: "#A9A538",
        轻度污染: "#E0991D",
        中度污染: "#D96161",
        重度污染: "#A257D0",
        严重污染: "#D94371"
    };
    air.tag_color = color[air.category];
    return air;
}
export function add_hour_data(hourly: Hourly[], hourlyType: HourlyType, timezone: string): any[] {
    if (!hourly || hourly.length === 0) {
        return [];
    }
    const temps = hourly.map((hour) => parseInt(hour.temp, 10));
    const min_temp = Math.min(...temps);
    const high = Math.max(...temps);
    const low = min_temp - (high - min_temp);

    for (const hour of hourly) {
        const date_time = moent(hour.fxTime).tz(timezone);
        const hourNum = date_time.hour();
        hour.hour = (hourNum % 12 === 0 ? 12 : hourNum % 12).toString();
        hour.hour += hourNum < 12 ? "AM" : "PM";
        if (high === low) {
            hour.temp_percent = "100px";
        } else {
            hour.temp_percent = `${Math.round(((parseInt(hour.temp, 10) - low) / (high - low)) * 100)}px`;
        }
    }
    if (hourlyType === HourlyType.current_12h) {
        return hourly.slice(0, 12);
    }
    if (hourlyType === HourlyType.current_24h) {
        return hourly.filter((_, idx) => idx % 2 === 0);
    }
    return hourly;
}
export function add_date(daily: any[]): any[] {
    const week_map = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

    daily.forEach((day, idx) => {
        const date = day.fxDate.split("-");
        const _year = parseInt(date[0], 10);
        const _month = parseInt(date[1], 10);
        const _day = parseInt(date[2], 10);
        const week = new Date(_year, _month - 1, _day).getDay();
        day.week = idx === 0 ? "今日" : week_map[week];
        day.date = `${_month}月${_day}日`;
    });

    return daily;
}

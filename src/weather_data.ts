import axios from "axios";
import { getJwtToken, JwtConfig } from "./utils";
import { NowApi, DailyApi, AirApi, WarningApi, HourlyApi } from "./model";
import { Config } from ".";

export class ConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ConfigError";
    }
}

export class CityNotFoundError extends Error {
    constructor() {
        super("City not found");
        this.name = "CityNotFoundError";
    }
}

export class APIError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "APIError";
    }
}

export class Weather {
    private config: Config;
    public cityId: string | null = null;
    public now!: NowApi;
    public daily!: DailyApi;
    public air!: AirApi;
    public warning!: WarningApi | null;
    public hourly!: HourlyApi;

    constructor(
        public cityName: string,
        config: Config
    ) {
        this.config = config;
        this._validateForecastDays();
    }

    private _validateForecastDays() {
        if (
            this.config.qweather_apitype === 0 &&
            (this.config.qweather_forecast_days < 3 || this.config.qweather_forecast_days > 7)
        ) {
            throw new ConfigError("When apiType=0 (free subscription), forecast days must be 3≤x≤7");
        }
    }

    private async _getCityId(): Promise<string> {
        const url = `${this.config.qweather_apihost}/geo/v2/city/lookup`;
        const params = { location: this.cityName, number: 1 };

        try {
            const response = await this._request(url, params);

            if (response.code === "404") {
                throw new CityNotFoundError();
            }

            if (response.code !== "200") {
                throw new APIError(
                    `Error code: ${response.code} - Refer to: https://dev.qweather.com/docs/start/status-code/`
                );
            }

            this.cityName = response.location[0].name;
            return response.location[0].id;
        } catch (error) {
            throw new APIError(`Failed to get city ID: ${error}`);
        }
    }

    private async _request(url: string, params: any) {
        const headers: any = {};

        if (this.config.qweather_apikey) {
            headers["X-QW-Api-Key"] = this.config.qweather_apikey;
        } else if (this.config.qweather_use_jwt) {
            const jwtConfig: JwtConfig = {
                qweather_jwt_sub: this.config.qweather_jwt_sub!,
                qweather_jwt_kid: this.config.qweather_jwt_kid!,
                qweather_jwt_private_key: this.config.qweather_jwt_private_key!
            };
            const token = await getJwtToken(jwtConfig);
            headers.Authorization = `Bearer ${token}`;
        } else {
            throw new ConfigError("Please configure API Key or JWT");
        }

        try {
            const response = await axios.get(url, {
                params,
                headers
            });
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new APIError(`HTTP Error: ${error.response?.status}`);
            }
            throw new APIError("Network request failed");
        }
    }

    public async load(): Promise<void> {
        this.cityId = await this._getCityId();

        const [nowData, dailyData, airData, warningData, hourlyData] = await Promise.all([
            this._getNow(),
            this._getDaily(),
            this._getAir(),
            this._getWarning(),
            this._getHourly()
        ]);

        this.now = nowData;
        this.daily = dailyData;
        this.air = airData;
        this.warning = warningData;
        this.hourly = hourlyData;

        this._validateData();
    }

    private async _getNow(): Promise<NowApi> {
        const url = `${this.config.qweather_apihost}/v7/weather/now`;
        const params = { location: this.cityId! };
        const data = await this._request(url, params);
        return data as NowApi;
    }

    private async _getDaily(): Promise<DailyApi> {
        const days = this.config.qweather_forecast_days;
        const url = `${this.config.qweather_apihost}/v7/weather/${days}d`;
        const params = { location: this.cityId! };
        const data = await this._request(url, params);
        return data as DailyApi;
    }

    private async _getAir(): Promise<AirApi> {
        const url = `${this.config.qweather_apihost}/v7/air/now`;
        const params = { location: this.cityId! };
        const data = await this._request(url, params);
        return data as AirApi;
    }

    private async _getWarning(): Promise<WarningApi | null> {
        const url = `${this.config.qweather_apihost}/v7/warning/now`;
        const params = { location: this.cityId! };
        const data = await this._request(url, params);

        return data.code === "204" ? null : (data as WarningApi);
    }

    private async _getHourly(): Promise<HourlyApi> {
        const url = `${this.config.qweather_apihost}/v7/weather/24h`;
        const params = { location: this.cityId! };
        const data = await this._request(url, params);
        return data as HourlyApi;
    }

    private _validateData() {
        const errors: string[] = [];

        if (this.now.code !== "200") {
            errors.push(`Now: ${this.now.code}`);
        }
        if (this.daily.code !== "200") {
            errors.push(`Daily: ${this.daily.code}`);
        }
        if (this.air.code !== "200") {
            errors.push(`Air: ${this.air.code}`);
        }
        if (this.warning?.code !== "200") {
            errors.push(`Warning: ${this.warning?.code}`);
        }
        if (this.hourly.code !== "200") {
            errors.push(`Hourly: ${this.hourly.code}`);
        }

        if (errors.length > 0) {
            throw new APIError(
                `API validation failed: ${errors.join(
                    ", "
                )}\nRefer to: https://dev.qweather.com/docs/start/status-code/`
            );
        }
    }
}

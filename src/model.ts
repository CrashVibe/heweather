export interface Now {
    obsTime: string;
    temp: string;
    icon: string;
    text: string;
    windScale: string;
    windDir: string;
    humidity: string;
    precip: string;
    vis: string;
}

export interface NowApi {
    code: string;
    now: Now;
}

export interface Daily {
    fxDate: string;
    week?: string;
    date?: string;
    tempMax: string;
    tempMin: string;
    textDay: string;
    textNight: string;
    iconDay: string;
    iconNight: string;
}

export interface DailyApi {
    code: string;
    daily: Daily[];
}

export interface Air {
    category: string;
    aqi: string;
    pm2p5: string;
    pm10: string;
    o3: string;
    co: string;
    no2: string;
    so2: string;
    tag_color?: string;
}

export interface AirApi {
    code: string;
    now?: Air;
}

export interface Warning {
    title: string;
    type: string;
    pubTime: string;
    text: string;
}

export interface WarningApi {
    code: string;
    warning?: Warning[];
}

export interface Hourly {
    fxTime: string;
    hour?: string;
    temp: string;
    icon: string;
    text: string;
    temp_percent?: string;
}

export interface HourlyApi {
    code: string;
    hourly: Hourly[];
}

export enum HourlyType {
    current_12h = 1,
    current_24h = 2
}

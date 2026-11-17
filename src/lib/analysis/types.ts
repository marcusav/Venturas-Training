/** Séries temporais de uma atividade (formato "key_by_type" da API do Strava). */
export interface Streams {
  time: number[]; // s desde o início
  distance: number[]; // m acumulados
  heartrate?: number[]; // bpm
  velocity?: number[]; // m/s (velocity_smooth)
  grade?: number[]; // % (grade_smooth)
  altitude?: number[]; // m
  moving?: boolean[];
}

/** Limites de zona de FC no formato do Strava: [{min,max}], a última com max -1 ou ausente. */
export type HrZones = { min: number; max: number }[];

export interface ActivitySummary {
  id: number;
  startDate: string; // ISO (UTC)
  distanceM: number;
  movingTimeS: number;
  sportType: string;
}

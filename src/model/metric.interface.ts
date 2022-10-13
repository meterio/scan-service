import { MetricType } from '../const';

export interface Metric {
  key: string;
  value: string;
  type: MetricType;
}

import { Schema, model } from 'mongoose';
import { MetricType } from '../const';

export interface IMetric {
  key: string;
  value: string;
  type: MetricType;
  updatedAt?: number;
}

const metricSchema = new Schema<IMetric>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true },
    type: { type: String, required: true },

    updatedAt: { type: Number },
  },
  {
    timestamps: { currentTime: () => Math.floor(Date.now() / 1000) },
  }
);

metricSchema.index({ address: 1 });

metricSchema.set('toJSON', {
  transform: (obj, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

export const Metric = model<IMetric>('Metric', metricSchema, 'metric');

import mongoose from 'mongoose';

import { MetricType } from '../const';
import { Metric } from './metric.interface';

const metricSchema = new mongoose.Schema<Metric>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true },
    type: {
      type: String,
      get: (typeStr: string) => MetricType[typeStr as keyof typeof MetricType],
      set: (type: MetricType) => MetricType[type],
      required: true,
    },

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

const model = mongoose.model<Metric & mongoose.Document>('Metric', metricSchema, 'metric');

export default model;

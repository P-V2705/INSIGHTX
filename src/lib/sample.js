import { createDatasetFromObjects } from './dataset.js';

const REGIONS = [
  {
    name: 'North America',
    weight: 0.44,
    accounts: ['Northwind Labs', 'Copperline Group', 'Harborview Health', 'Redwood Retail', 'Meridian Freight', 'Granite Peak Co.'],
  },
  {
    name: 'Europe',
    weight: 0.33,
    accounts: ['Lumen & Co', 'Nordwind GmbH', 'Atlas Retail', 'Bluekite Media', 'Helios Energy', 'Vantage Foods'],
  },
  {
    name: 'APAC',
    weight: 0.23,
    accounts: ['Sakura Systems', 'Harborline Logistics', 'Pacific Ridge', 'Nimbus Digital', 'Orion Foods', 'Kestrel Labs'],
  },
];

const PRODUCTS = [
  { name: 'Atlas CRM', price: 420, weight: 0.32 },
  { name: 'Beacon Analytics', price: 310, weight: 0.28 },
  { name: 'Cobalt Cloud', price: 240, weight: 0.23 },
  { name: 'Delta Desk', price: 180, weight: 0.17 },
];

const CHANNELS = [
  { name: 'Direct', weight: 0.42 },
  { name: 'Partner', weight: 0.33 },
  { name: 'Online', weight: 0.25 },
];

const SEGMENTS = [
  { name: 'Enterprise', weight: 0.3 },
  { name: 'Mid-market', weight: 0.45 },
  { name: 'SMB', weight: 0.25 },
];

function mulberry32(seed) {
  let state = seed;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick(random, items) {
  const roll = random();
  let cumulative = 0;
  for (const item of items) {
    cumulative += item.weight;
    if (roll <= cumulative) return item;
  }
  return items[items.length - 1];
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function buildSampleRecords() {
  const random = mulberry32(20261111);
  const records = [];
  let accountCursor = 0;

  for (let monthOffset = 0; monthOffset < 24; monthOffset += 1) {
    const year = 2024 + Math.floor(monthOffset / 12);
    const month = monthOffset % 12;
    const growth = 1 + monthOffset * 0.0115;
    const seasonal = 1 + 0.09 * Math.sin(((month + 2) / 12) * Math.PI * 2);

    for (let order = 0; order < 9; order += 1) {
      const region = weightedPick(random, REGIONS);
      const product = weightedPick(random, PRODUCTS);
      const channel = weightedPick(random, CHANNELS);
      const segment = weightedPick(random, SEGMENTS);

      const day = 1 + Math.floor(random() * 27);
      const units = Math.max(4, Math.round((10 + random() * 66) * growth * seasonal * (segment.name === 'Enterprise' ? 1.15 : 1)));
      const priceJitter = 1 + (random() - 0.5) * 0.07;
      const unitPrice = Math.round(product.price * priceJitter);
      const discountPct = random() < 0.74 ? Math.round(4 + random() * 14) : null;
      const revenue = Math.round(units * unitPrice * (1 - (discountPct ?? 0) / 100));
      const satisfaction = random() < 0.94 ? Math.round((3.5 + random() * 1.45) * 10) / 10 : null;
      const account = region.accounts[accountCursor % region.accounts.length];
      accountCursor += 1;

      records.push({
        order_date: `${year}-${pad(month + 1)}-${pad(day)}`,
        region: region.name,
        channel: random() < 0.985 ? channel.name : null,
        product: product.name,
        segment: segment.name,
        account,
        units,
        unit_price: unitPrice,
        revenue,
        discount_pct: discountPct,
        satisfaction,
      });
    }
  }

  records.sort((a, b) => a.order_date.localeCompare(b.order_date));
  return records;
}

export function buildSampleDataset() {
  const records = buildSampleRecords();
  const dataset = createDatasetFromObjects(records, { sourceRowCount: records.length });
  return {
    dataset,
    source: {
      kind: 'sample',
      fileName: 'insightx-sample-sales.csv',
      format: 'Built-in sample',
      sizeBytes: null,
      sheetName: null,
      addedAt: new Date().toISOString(),
    },
  };
}

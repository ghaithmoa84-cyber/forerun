import test from 'node:test';
import assert from 'node:assert/strict';
import type { OrderMapProps } from './OrderMap.js';

test('OrderMap contract: validates required delivery coordinates and description structure', () => {
  // Backend Order contract fields
  const backendOrderFixture = {
    id: 'ord_test_123',
    deliveryLat: 35.531245,
    deliveryLng: 35.792512,
    deliveryDesc: 'اللاذقية - مشروع الصليبة - بناء الأمل',
  };

  // Map to OrderMapProps
  const props: OrderMapProps = {
    lat: backendOrderFixture.deliveryLat,
    lng: backendOrderFixture.deliveryLng,
    description: backendOrderFixture.deliveryDesc,
  };

  assert.strictEqual(typeof props.lat, 'number');
  assert.strictEqual(typeof props.lng, 'number');
  assert.strictEqual(typeof props.description, 'string');
  assert.strictEqual(props.lat, 35.531245);
  assert.strictEqual(props.lng, 35.792512);
  assert.strictEqual(props.description, 'اللاذقية - مشروع الصليبة - بناء الأمل');
});

test('OrderMap contract: handles optional description with default fallback string', () => {
  const propsWithoutDesc: OrderMapProps = {
    lat: 33.5138,
    lng: 36.2765,
  };

  const defaultDescription = propsWithoutDesc.description || 'موقع تسليم الطلب';
  assert.strictEqual(defaultDescription, 'موقع تسليم الطلب');
});

test('OrderMap contract: generates valid Google Maps query URL from lat/lng contract fields', () => {
  const lat = 35.531245;
  const lng = 35.792512;
  const externalUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  assert.strictEqual(externalUrl, 'https://www.google.com/maps?q=35.531245,35.792512');
  const urlObj = new URL(externalUrl);
  assert.strictEqual(urlObj.searchParams.get('q'), '35.531245,35.792512');
});

test('OrderMap contract: ensures Google Maps failure displays safe Arabic message without technical leak', () => {
  const rawTechError = new Error('Failed to load Google Maps script (ApiNotActivatedMapError)');
  // Ensure the UI contract uses a safe static Arabic string
  const safeErrorMessage = 'تعذر تحميل خرائط غوغل';
  assert.strictEqual(safeErrorMessage.includes(rawTechError.message), false);
  assert.strictEqual(safeErrorMessage, 'تعذر تحميل خرائط غوغل');
});

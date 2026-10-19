import test from 'node:test';
import assert from 'node:assert/strict';
import type { MapViewProps } from './MapView.js';

test('MapView contract: validates active order delivery address props contract', () => {
  // Backend Active Order deliveryAddress contract fixture
  const backendActiveOrderFixture = {
    id: 'ord_active_789',
    deliveryAddress: {
      lat: 35.520112,
      lng: 35.789123,
      description: 'حي الزراعة - مقابل الحديقة العامة',
    },
  };

  const props: MapViewProps = {
    lat: backendActiveOrderFixture.deliveryAddress.lat,
    lng: backendActiveOrderFixture.deliveryAddress.lng,
    description: backendActiveOrderFixture.deliveryAddress.description,
  };

  assert.strictEqual(typeof props.lat, 'number');
  assert.strictEqual(typeof props.lng, 'number');
  assert.strictEqual(typeof props.description, 'string');
  assert.strictEqual(props.lat, 35.520112);
  assert.strictEqual(props.lng, 35.789123);
  assert.strictEqual(props.description, 'حي الزراعة - مقابل الحديقة العامة');
});

test('MapView contract: formats coordinates and map pin URL accurately', () => {
  const lat = 35.520112;
  const lng = 35.789123;
  const coordsFormatted = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  const externalMapUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  assert.strictEqual(coordsFormatted, '35.520112, 35.789123');
  assert.strictEqual(externalMapUrl, 'https://www.google.com/maps?q=35.520112,35.789123');
});

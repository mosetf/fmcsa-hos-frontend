/** Decode an encoded polyline string into Leaflet-friendly latitude/longitude pairs. */
export function decodePolyline(encoded: string): [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    const latitudeResult = decodeChunk(encoded, index);
    latitude += latitudeResult.value;
    index = latitudeResult.nextIndex;

    const longitudeResult = decodeChunk(encoded, index);
    longitude += longitudeResult.value;
    index = longitudeResult.nextIndex;

    coordinates.push([latitude / 1e5, longitude / 1e5]);
  }

  return coordinates;
}

/** Decode one signed polyline chunk and return the value plus the next cursor position. */
function decodeChunk(encoded: string, startIndex: number): { value: number; nextIndex: number } {
  let result = 0;
  let shift = 0;
  let index = startIndex;
  let byte: number;

  do {
    byte = encoded.charCodeAt(index) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
    index += 1;
  } while (byte >= 0x20 && index <= encoded.length);

  return {
    value: result & 1 ? ~(result >> 1) : result >> 1,
    nextIndex: index,
  };
}

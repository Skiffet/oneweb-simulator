export const getApproxElevation = (lat, lon) => {
  let elev = 0.0;
  // Tibetan Plateau / Himalayas (~4.5 to 5.5 km)
  if (lat >= 25 && lat <= 40 && lon >= 70 && lon <= 105) {
    const dist = Math.sqrt(Math.pow(lat - 32.5, 2) + Math.pow(lon - 87.5, 2));
    if (dist < 15) elev += 5.0 * Math.exp(-0.02 * Math.pow(dist, 2));
  }
  // Thai northern mountains (~1.5 to 2.5 km)
  if (lat >= 17 && lat <= 21 && lon >= 97 && lon <= 101) {
    const dist = Math.sqrt(Math.pow(lat - 19.0, 2) + Math.pow(lon - 99.0, 2));
    if (dist < 3) elev += 2.0 * Math.exp(-0.2 * Math.pow(dist, 2));
  }
  // Andes mountains proxy (~4 km)
  if (lat >= -35 && lat <= 10 && lon >= -80 && lon <= -65) {
    const dist = Math.sqrt(Math.pow((lat + 15)/2, 2) + Math.pow(lon + 70, 2));
    if (dist < 10) elev += 4.0 * Math.exp(-0.05 * Math.pow(dist, 2));
  }
  return Math.max(0.0, elev);
};

export const getSatelliteDistance3D = (sat1, sat2) => {
  const a = 6378.137;
  const b = 6356.752;
  const lat1 = sat1.lat * Math.PI / 180;
  const lon1 = sat1.lon * Math.PI / 180;
  const lat2 = sat2.lat * Math.PI / 180;
  const lon2 = sat2.lon * Math.PI / 180;
  const R_earth1 = Math.sqrt((Math.pow(a*a*Math.cos(lat1), 2) + Math.pow(b*b*Math.sin(lat1), 2)) / (Math.pow(a*Math.cos(lat1), 2) + Math.pow(b*Math.sin(lat1), 2)));
  const R_earth2 = Math.sqrt((Math.pow(a*a*Math.cos(lat2), 2) + Math.pow(b*b*Math.sin(lat2), 2)) / (Math.pow(a*Math.cos(lat2), 2) + Math.pow(b*Math.sin(lat2), 2)));
  const alt1 = sat1.alt || 1200;
  const alt2 = sat2.alt || 1200;
  const R1 = R_earth1 + alt1;
  const R2 = R_earth2 + alt2;
  const x1 = R1 * Math.cos(lat1) * Math.cos(lon1);
  const y1 = R1 * Math.cos(lat1) * Math.sin(lon1);
  const z1 = R1 * Math.sin(lat1);
  const x2 = R2 * Math.cos(lat2) * Math.cos(lon2);
  const y2 = R2 * Math.cos(lat2) * Math.sin(lon2);
  const z2 = R2 * Math.sin(lat2);
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2));
};

export const distanceEqual = (prevProps, nextProps) => {
  return prevProps.line.lat1 === nextProps.line.lat1 &&
         prevProps.line.lon1 === nextProps.line.lon1 &&
         prevProps.line.lat2 === nextProps.line.lat2 &&
         prevProps.line.lon2 === nextProps.line.lon2;
};

export const satEqual = (prevProps, nextProps) => {
  return prevProps.sat.lat === nextProps.sat.lat &&
         prevProps.sat.lon === nextProps.sat.lon &&
         prevProps.switches.covBox === nextProps.switches.covBox &&
         prevProps.switches.covStrips === nextProps.switches.covStrips &&
         prevProps.switches.maxService === nextProps.switches.maxService &&
         prevProps.switches.progPitch === nextProps.switches.progPitch;
};

import { useMemo } from 'react';
import { Dimensions, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

const { width: SCREEN_W } = Dimensions.get('window');
export const MAP_W = SCREEN_W;
export const MAP_H = Math.round(SCREEN_W / 2);

export function latLonToXY(lat, lon) {
  return {
    x: ((lon + 180) / 360) * MAP_W,
    y: ((90 - lat) / 180) * MAP_H,
  };
}

const GRID_LATS = [-60, -30, 0, 30, 60];
const GRID_LONS = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
const TH = { minLat: 5.6, maxLat: 20.5, minLon: 97.3, maxLon: 105.6 };

export function SVGWorldMap({ satellites = [], switches = {}, distanceLines = [] }) {
  const sats = useMemo(
    () => satellites.filter(s => s.lat != null && s.lon != null),
    [satellites]
  );

  const thTL = latLonToXY(TH.maxLat, TH.minLon);
  const thBR = latLonToXY(TH.minLat, TH.maxLon);

  return (
    <View style={{ width: MAP_W, height: MAP_H }}>
      <Svg width={MAP_W} height={MAP_H}>
        {/* Background */}
        <Rect x={0} y={0} width={MAP_W} height={MAP_H} fill="#0f172a" />

        {/* Grid */}
        {GRID_LATS.map(lat => {
          const { y } = latLonToXY(lat, 0);
          return (
            <Line
              key={`lat${lat}`}
              x1={0} y1={y} x2={MAP_W} y2={y}
              stroke={lat === 0 ? '#334155' : '#1e293b'}
              strokeWidth={lat === 0 ? 1 : 0.5}
            />
          );
        })}
        {GRID_LONS.map(lon => {
          const { x } = latLonToXY(0, lon);
          return (
            <Line
              key={`lon${lon}`}
              x1={x} y1={0} x2={x} y2={MAP_H}
              stroke={lon === 0 ? '#334155' : '#1e293b'}
              strokeWidth={lon === 0 ? 1 : 0.5}
            />
          );
        })}

        {/* Lat/Lon labels */}
        {GRID_LATS.map(lat => {
          const { y } = latLonToXY(lat, 0);
          return (
            <SvgText key={`llab${lat}`} x={4} y={y - 2} fill="#334155" fontSize={7}>
              {lat}°
            </SvgText>
          );
        })}
        {GRID_LONS.map(lon => {
          const { x } = latLonToXY(0, lon);
          return (
            <SvgText key={`llab${lon}`} x={x + 2} y={MAP_H - 2} fill="#334155" fontSize={7}>
              {lon}°
            </SvgText>
          );
        })}

        {/* Thailand bounding box */}
        <Rect
          x={thTL.x} y={thTL.y}
          width={thBR.x - thTL.x} height={thBR.y - thTL.y}
          fill="rgba(16,185,129,0.06)"
          stroke="#10b981"
          strokeWidth={1}
          strokeDasharray="4,3"
        />
        <SvgText x={thTL.x + 2} y={thTL.y + 9} fill="#10b981" fontSize={6} fontWeight="bold">
          TH
        </SvgText>

        {/* Distance lines */}
        {switches.distances && distanceLines.map((line, i) => {
          const a = latLonToXY(line.lat1, line.lon1);
          const b = latLonToXY(line.lat2, line.lon2);
          if (Math.abs(a.x - b.x) > MAP_W * 0.5) return null;
          return (
            <Line
              key={`dl${i}`}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="#2563eb" strokeWidth={0.8} strokeDasharray="3,3"
              opacity={0.6}
            />
          );
        })}

        {/* Satellites */}
        {sats.map((sat, i) => {
          const { x, y } = latLonToXY(sat.lat, sat.lon);
          const isOneweb = sat.name && sat.name.toUpperCase().includes('ONEWEB');
          const isOverTH =
            sat.lat >= TH.minLat && sat.lat <= TH.maxLat &&
            sat.lon >= TH.minLon && sat.lon <= TH.maxLon;
          const isMuted = switches.progPitch && sat.isTurnedOff;

          let fill = '#475569';
          if (isMuted) fill = '#334155';
          else if (isOneweb) fill = isOverTH ? '#ef4444' : '#3b82f6';

          const r = isOneweb ? (isOverTH ? 3 : 2.5) : 1.5;

          return (
            <G key={sat.noradId ?? i}>
              {switches.maxService && isOneweb && (
                <Circle
                  cx={x} cy={y}
                  r={Math.min(MAP_W * 0.034, 12)}
                  fill="rgba(234,179,8,0.04)"
                  stroke="#eab308"
                  strokeWidth={0.5}
                  strokeDasharray="3,3"
                />
              )}
              <Circle cx={x} cy={y} r={r} fill={fill} opacity={0.9} />
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

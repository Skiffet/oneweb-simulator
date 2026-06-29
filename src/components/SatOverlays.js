import React from 'react';
import { Marker, Circle, Polygon } from 'react-native-maps';
import { satEqual, getApproxElevation } from '../utils/mathUtils';

export const SatOverlays = React.memo(({ sat, switches, stripColor }) => {
  if (sat.lat == null || sat.lon == null) return null;
  
  const isOneweb = sat.name && sat.name.toUpperCase().includes('ONEWEB');
  const showPitch = switches.progPitch;
  const isMuted = showPitch && sat.isTurnedOff;
  
  const isOverThailand = sat.lat >= 5.6 && sat.lat <= 20.5 && sat.lon >= 97.3 && sat.lon <= 105.6;

  let fillColor = 'rgba(239, 68, 68, 0.4)';
  let strokeColor = 'rgba(239, 68, 68, 0.8)';

  if (sat.isTurnedOff) {
    fillColor = 'rgba(148, 163, 184, 0.4)';
    strokeColor = 'rgba(100, 116, 139, 0.8)';
  } else if (isOneweb) {
    if (isOverThailand) {
      fillColor = 'rgba(239, 68, 68, 0.6)';
      strokeColor = 'rgba(220, 38, 38, 1)';
    } else {
      fillColor = 'rgba(59, 130, 246, 0.4)';
      strokeColor = 'rgba(59, 130, 246, 0.8)';
    }
  }

  // SRTM/Elevation scaling for Footprint Radius
  const satAlt = sat.alt || 1200;
  const elevKm = getApproxElevation(sat.lat, sat.lon);
  const trueHeight = Math.max(10, satAlt - elevKm);
  const scaleFactor = trueHeight / satAlt;
  const dynamicRadius = 684000 * scaleFactor;

  return (
    <React.Fragment>
      <Marker
        coordinate={{ latitude: sat.lat, longitude: sat.lon }}
        title={sat.name}
        description={`Alt: ${sat.alt?.toFixed(1)} km`}
        opacity={0}
        tracksViewChanges={false}
      />
      
      <Circle
        center={{ latitude: sat.lat, longitude: sat.lon }}
        radius={20000}
        fillColor={fillColor}
        strokeColor={strokeColor}
        strokeWidth={2}
      />

      {switches.covBox && sat.footprint && sat.footprint.length > 0 && (
        <Polygon
          coordinates={sat.footprint.map(p => ({ latitude: p[0], longitude: p[1] }))}
          fillColor="rgba(192, 132, 252, 0.05)"
          strokeColor="#c084fc"
          strokeWidth={2}
        />
      )}

      {switches.covStrips && isOneweb && sat.strips_polygon && sat.strips_polygon.length > 0 && sat.strips_polygon.map((strip, i) => (
        <Polygon
          key={`strip-${i}`}
          coordinates={strip.map(p => ({ latitude: p[0], longitude: p[1] }))}
          fillColor="transparent"
          strokeColor={isMuted ? '#94a3b8' : stripColor}
          strokeWidth={2}
          lineDashPattern={isMuted ? [4, 4] : undefined}
        />
      ))}
      
      {switches.maxService && isOneweb && (
        <Circle 
          center={{ latitude: sat.lat, longitude: sat.lon }} 
          radius={dynamicRadius} 
          strokeColor="#eab308" 
          fillColor="rgba(234, 179, 8, 0.05)" 
          strokeWidth={1} 
          lineDashPattern={[5, 5]} 
        />
      )}
    </React.Fragment>
  );
}, satEqual);

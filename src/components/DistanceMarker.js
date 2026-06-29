import React, { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { Marker } from 'react-native-maps';
import { distanceEqual } from '../utils/mathUtils';

export const DistanceMarker = React.memo(({ line }) => {
  const [trackChanges, setTrackChanges] = useState(true);
  
  let lon1 = line.lon1;
  let lon2 = line.lon2;
  if (Math.abs(lon1 - lon2) > 180) {
    if (lon1 < 0) lon1 += 360;
    if (lon2 < 0) lon2 += 360;
  }
  let midLon = (lon1 + lon2) / 2;
  if (midLon > 180) midLon -= 360;
  
  const midLat = (line.lat1 + line.lat2) / 2;
  const distStr = `${Math.round(line.dist)} KM`; 

  useEffect(() => {
    setTrackChanges(true);
    const timer = setTimeout(() => setTrackChanges(false), 1500);
    return () => clearTimeout(timer);
  }, [line.lat1, line.lon1, line.lat2, line.lon2]);

  return (
    <Marker 
      coordinate={{ latitude: midLat, longitude: midLon }} 
      anchor={{ x: 0.5, y: 0.5 }} 
      tracksViewChanges={trackChanges} 
      zIndex={999}
    >
      <Text allowFontScaling={false} style={{ 
        fontSize: 6, 
        color: '#000000', 
        fontWeight: 'bold', 
        backgroundColor: 'rgba(255,255,255,0.7)', 
        paddingHorizontal: 2,
        paddingVertical: 0,
        borderRadius: 2,
        overflow: 'hidden', 
        textAlign: 'center',
        textAlignVertical: 'center'
      }}>
        {distStr}
      </Text>
    </Marker>
  );
}, distanceEqual);

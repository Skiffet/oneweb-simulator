import numpy as np

import srtm

# Load SRTM data into memory (will download missing tiles automatically)
# This might cause a slight delay on the very first API call for a new area
elevation_data = srtm.get_data()

def get_approx_elevation(lat, lon, use_real_elevation=True):
    """
    Retrieves real-world terrain elevation using NASA SRTM data if use_real_elevation is True.
    If False, uses a mathematical 2D Gaussian function fallback to simulate major geographic features
    without needing a massive DEM dataset file to prevent lag.
    Returns elevation in km.
    """
    if use_real_elevation:
        try:
            elev_meters = elevation_data.get_elevation(lat, lon)
            if elev_meters is None:
                elev_meters = 0.0 # Fallback to sea level if no data
            
            # We allow negative elevation (below sea level) for maximum accuracy
            return elev_meters / 1000.0
        except Exception as e:
            print(f"SRTM error for {lat},{lon}: {e}")
            return 0.0
    else:
        elev = 0.0
        # Tibetan Plateau / Himalayas (~4.5 to 5.5 km)
        if 25 <= lat <= 40 and 70 <= lon <= 105:
            dist = np.sqrt((lat - 32.5)**2 + (lon - 87.5)**2)
            if dist < 15:
                elev += 5.0 * np.exp(-0.02 * dist**2)
                
        # Thai northern mountains (~1.5 to 2.5 km)
        if 17 <= lat <= 21 and 97 <= lon <= 101:
            dist = np.sqrt((lat - 19.0)**2 + (lon - 99.0)**2)
            if dist < 3:
                elev += 2.0 * np.exp(-0.2 * dist**2)
                
        # Andes mountains proxy (~4 km)
        if -35 <= lat <= 10 and -80 <= lon <= -65:
            dist = np.sqrt(((lat + 15)/2)**2 + (lon + 70)**2)
            if dist < 10:
                elev += 4.0 * np.exp(-0.05 * dist**2)
                
        return max(0.0, elev)

def calculate_footprint_polygon(sat_lat, sat_lon, sat_alt_km, base_width=1600.0, base_height=1024.0, use_real_elevation=True):
    """
    Rigorous mathematical calculation of the RF beam footprint onto the WGS84 Ellipsoid,
    incorporating local terrain elevation.
    
    1. The satellite emits a fixed-angle beam (Projector Principle).
    2. Ground elevation reduces the distance from satellite to ground, shrinking the footprint.
    3. WGS84 ellipsoid curvature defines how the footprint stretches in Lat vs Lon.
    """
    # WGS84 Parameters
    a = 6378.1370  # Equatorial radius in km
    b = 6356.7523142  # Polar radius in km
    e2 = 1 - (b**2 / a**2) # Eccentricity squared
    
    # 1. Get terrain elevation at subpoint
    E = get_approx_elevation(sat_lat, sat_lon, use_real_elevation)
    
    # 2. Ray-Cone Intersection Logic (Simplified for real-time performance)
    # The footprint radius scales directly with the true distance from satellite to terrain.
    true_h = sat_alt_km - E
    if true_h < 10: true_h = 10 # Fallback to prevent negative distances if alt is wrong
    
    # Geometric scaling of the footprint (Projector Cone Math)
    scale_factor = true_h / sat_alt_km
    width_km = base_width * scale_factor
    height_km = base_height * scale_factor
    
    # 3. WGS84 Radii of Curvature for accurate degree conversion
    lat_rad = np.radians(sat_lat)
    
    # M: Radius of curvature in the meridian (Latitude scaling)
    M = (a * (1 - e2)) / (1 - e2 * np.sin(lat_rad)**2)**1.5
    
    # N: Radius of curvature in the prime vertical (Longitude scaling)
    N = a / np.sqrt(1 - e2 * np.sin(lat_rad)**2)
    
    # Conversion factors: km to degrees
    dlat_per_km = 1.0 / (M * np.pi / 180.0)
    dlon_per_km = 1.0 / (N * np.cos(lat_rad) * np.pi / 180.0)
    
    rx_deg = (width_km / 2.0) * dlon_per_km
    ry_deg = (height_km / 2.0) * dlat_per_km
    
    # 4. Generate Polygon Points (16 points for a smooth ellipse)
    points = []
    num_points = 16
    for angle in np.linspace(0, 2*np.pi, num_points, endpoint=False):
        plat = sat_lat + ry_deg * np.sin(angle)
        plon = sat_lon + rx_deg * np.cos(angle)
        points.append([round(float(plat), 4), round(float(plon), 4)])
        
    return points, round(float(E), 2), round(float(width_km), 1), round(float(height_km), 1)

def calculate_oneweb_strips(sat_lat, sat_lon, heading_rad, pitch_offset_km=0.0):
    """
    Calculates 16 highly elliptical spot beams for OneWeb satellites.
    Based on FCC filing: Aggregate beam coverage area is approx 1140 km x 1140 km.
    16 beams are arranged in a single row in the north-south (along-track) direction.
    pitch_offset_km shifts the entire footprint along the track.
    """
    a = 6378.1370
    b = 6356.7523142
    e2 = 1 - (b**2 / a**2)
    lat_rad = np.radians(sat_lat)
    M = (a * (1 - e2)) / (1 - e2 * np.sin(lat_rad)**2)**1.5
    N = a / np.sqrt(1 - e2 * np.sin(lat_rad)**2)
    
    dlat_per_km = 1.0 / (M * np.pi / 180.0)
    dlon_per_km = 1.0 / (N * np.cos(lat_rad) * np.pi / 180.0)
    
    strips = []
    
    # 1140 km total along-track length divided by 16 beams = 71.25 km spacing
    spacing_km = 1140.0 / 16.0 
    cross_track_radius_km = 1140.0 / 2.0  # 570 km
    
    # To create the overlap shown in the FCC paper's Figure A.3-1,
    # the along-track radius must be larger than half the spacing.
    # A multiplier of 0.75 ensures they overlap by 50% of their radius.
    along_track_radius_km = spacing_km * 0.75  # ~53.4 km
    
    for i in range(16):
        # Offset along track plus progressive pitch offset
        offset_km = ((i - 7.5) * spacing_km) + pitch_offset_km
        
        c_lat = sat_lat + (offset_km * np.cos(heading_rad)) * dlat_per_km
        c_lon = sat_lon + (offset_km * np.sin(heading_rad)) * dlon_per_km
        
        points = []
        # 16 points for each ellipse is enough for a smooth curve
        for angle in np.linspace(0, 2*np.pi, 24, endpoint=False):
            dx = cross_track_radius_km * np.cos(angle) # cross-track
            dy = along_track_radius_km * np.sin(angle)  # along-track
            
            d_north = dy * np.cos(heading_rad) - dx * np.sin(heading_rad)
            d_east = dy * np.sin(heading_rad) + dx * np.cos(heading_rad)
            
            plat = c_lat + d_north * dlat_per_km
            plon = c_lon + d_east * dlon_per_km
            points.append([round(float(plat), 4), round(float(plon), 4)])
        strips.append(points)
    
    return strips

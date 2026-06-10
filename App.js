import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";

const EARTH_RADIUS = 155;
const ORBIT_RADIUS = 270;
const CAMERA_DISTANCE = 720;
const SCREEN_SCALE = 560;
const ONEWEB_ALTITUDE_KM = 1200;
const ONEWEB_INCLINATION_DEG = 87.9;
const SATELLITE_PLANES = 12;
const SATELLITES_PER_PLANE = 54;
const TOTAL_SATELLITES = SATELLITE_PLANES * SATELLITES_PER_PLANE;
const GATEWAY_SITE_COUNT = 50;
const GATEWAY_ANTENNAS_PER_SITE = 10;
const USER_BEAMS_PER_SATELLITE = 16;
const ORBITAL_ANGULAR_SPEED = 0.0038;
const SATELLITE_HANDOVER_MARGIN = 1.12;
const GATEWAY_HANDOVER_MARGIN = 1.18;
const MAKE_BEFORE_BREAK_FRAMES = 34;
const UPDATE_MS = 55;

const ORBIT_PLANE_COLORS = [
  "#38bdf8",
  "#22d3ee",
  "#2dd4bf",
  "#34d399",
  "#84cc16",
  "#eab308",
  "#f59e0b",
  "#fb7185",
  "#c084fc",
  "#818cf8",
  "#60a5fa",
  "#fdba74",
];

const TRAFFIC_PROFILES = {
  Emergency: { priority: 5, color: "#e11d48", minMbps: 1, maxMbps: 8 },
  Voice: { priority: 4, color: "#f97316", minMbps: 1, maxMbps: 4 },
  "Video Conf": { priority: 4, color: "#f59e0b", minMbps: 4, maxMbps: 18 },
  "Enterprise VPN": { priority: 3, color: "#2563eb", minMbps: 8, maxMbps: 35 },
  Web: { priority: 2, color: "#16a34a", minMbps: 1, maxMbps: 12 },
  "Bulk Download": { priority: 1, color: "#64748b", minMbps: 15, maxMbps: 80 },
};

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function distance3(a, b) {
  const pa = a.position();
  const pb = b.position();
  return Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
}

function spherical(radius, lat, lon) {
  return {
    x: radius * Math.cos(lat) * Math.cos(lon),
    y: radius * Math.sin(lat),
    z: radius * Math.cos(lat) * Math.sin(lon),
  };
}

function trafficColor(type) {
  return TRAFFIC_PROFILES[type].color;
}

function trafficPriority(type) {
  return TRAFFIC_PROFILES[type].priority;
}

class Camera {
  constructor() {
    this.yaw = 0;
    this.pitch = (18 * Math.PI) / 180;
  }

  rotate(point) {
    const cosYaw = Math.cos(this.yaw);
    const sinYaw = Math.sin(this.yaw);
    let x = point.x * cosYaw + point.z * sinYaw;
    let z = -point.x * sinYaw + point.z * cosYaw;

    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    const y = point.y * cosPitch - z * sinPitch;
    z = point.y * sinPitch + z * cosPitch;
    return { x, y, z };
  }

  project(point, width, height, zoom) {
    const rotated = this.rotate(point);
    const depth = CAMERA_DISTANCE + rotated.z;
    const factor = (SCREEN_SCALE * zoom) / Math.max(180, depth);
    return {
      x: width / 2 + rotated.x * factor,
      y: height / 2 - rotated.y * factor,
      z: rotated.z,
      factor,
    };
  }
}

class Satellite {
  constructor(satId, anomaly, inclination, raan, planeIndex, slotIndex) {
    this.satId = satId;
    this.anomaly = anomaly;
    this.inclination = inclination;
    this.raan = raan;
    this.planeIndex = planeIndex;
    this.slotIndex = slotIndex;
    this.speed = ORBITAL_ANGULAR_SPEED;
    this.capacityMbps = 2100;
    this.loadMbps = 0;
    this.users = [];
    this.gateway = null;
  }

  update(speedScale) {
    this.anomaly = (this.anomaly + this.speed * speedScale) % (Math.PI * 2);
  }

  position() {
    const cosU = Math.cos(this.anomaly);
    const sinU = Math.sin(this.anomaly);
    const cosI = Math.cos(this.inclination);
    const sinI = Math.sin(this.inclination);
    const cosR = Math.cos(this.raan);
    const sinR = Math.sin(this.raan);
    return {
      x: ORBIT_RADIUS * (cosR * cosU - sinR * sinU * cosI),
      y: ORBIT_RADIUS * (sinU * sinI),
      z: ORBIT_RADIUS * (sinR * cosU + cosR * sinU * cosI),
    };
  }

  utilization() {
    return this.loadMbps / this.capacityMbps;
  }
}

class GroundNode {
  constructor(nodeId, name, latDeg, lonDeg, capacityMbps = 0, antennaCount = 0) {
    this.nodeId = nodeId;
    this.name = name;
    this.lat = (latDeg * Math.PI) / 180;
    this.lon = (lonDeg * Math.PI) / 180;
    this.capacityMbps = capacityMbps;
    this.antennaCount = antennaCount;
    this.loadMbps = 0;
    this.trackedSatellites = new Set();
  }

  position() {
    return spherical(EARTH_RADIUS + 3, this.lat, this.lon);
  }

  utilization() {
    return this.capacityMbps ? this.loadMbps / this.capacityMbps : 0;
  }
}

class UserTerminal extends GroundNode {
  constructor(userId) {
    const lat = -55 + Math.random() * 120;
    const lon = Math.random() * 360;
    super(`UT-${String(userId).padStart(2, "0")}`, `Terminal ${userId}`, lat, lon);
    const types = Object.keys(TRAFFIC_PROFILES);
    this.userId = userId;
    this.trafficType = types[Math.floor(Math.random() * types.length)];
    const profile = TRAFFIC_PROFILES[this.trafficType];
    this.demandMbps = profile.minMbps + Math.random() * (profile.maxMbps - profile.minMbps);
    this.authenticated = Math.random() > 0.08;
    this.connectedSat = null;
    this.connectedGateway = null;
    this.previousGateway = null;
    this.gatewayHandoverTimer = 0;
    this.lastSatId = null;
    this.lastGatewayId = null;
    this.handoverCount = 0;
    this.gatewayHandoverCount = 0;
    this.sessionState = this.authenticated ? "AUTH" : "DENIED";
    this.latencyMs = 0;
    this.allocatedMbps = 0;
    this.packetLoss = 0;
  }
}

function buildGatewaySites() {
  const seedSites = [
    ["GW-01", "North America West", 37, -122],
    ["GW-02", "North America Central", 39, -96],
    ["GW-03", "North America East", 40, -74],
    ["GW-04", "Canada", 51, -114],
    ["GW-05", "Alaska", 61, -150],
    ["GW-06", "Mexico", 20, -99],
    ["GW-07", "Brazil East", -23, -46],
    ["GW-08", "Brazil North", -3, -60],
    ["GW-09", "Chile", -33, -70],
    ["GW-10", "Argentina", -34, -58],
    ["GW-11", "United Kingdom", 52, -1],
    ["GW-12", "France", 48, 2],
    ["GW-13", "Spain", 40, -4],
    ["GW-14", "Germany", 51, 10],
    ["GW-15", "Italy", 43, 12],
    ["GW-16", "Norway", 60, 8],
    ["GW-17", "Sweden", 59, 18],
    ["GW-18", "Poland", 52, 19],
    ["GW-19", "Turkey", 39, 35],
    ["GW-20", "UAE", 24, 54],
    ["GW-21", "Saudi Arabia", 24, 45],
    ["GW-22", "South Africa", -26, 28],
    ["GW-23", "Kenya", -1, 37],
    ["GW-24", "Nigeria", 9, 8],
    ["GW-25", "Morocco", 32, -7],
    ["GW-26", "Egypt", 30, 31],
    ["GW-27", "India West", 19, 73],
    ["GW-28", "India North", 28, 77],
    ["GW-29", "India South", 13, 80],
    ["GW-30", "Thailand", 14, 101],
    ["GW-31", "Singapore", 1, 104],
    ["GW-32", "Malaysia", 3, 102],
    ["GW-33", "Indonesia West", -6, 107],
    ["GW-34", "Indonesia East", -5, 120],
    ["GW-35", "Philippines", 14, 121],
    ["GW-36", "Vietnam", 16, 108],
    ["GW-37", "Japan", 36, 140],
    ["GW-38", "Korea", 37, 127],
    ["GW-39", "China East", 31, 121],
    ["GW-40", "China North", 40, 116],
    ["GW-41", "Australia East", -33, 151],
    ["GW-42", "Australia West", -32, 116],
    ["GW-43", "New Zealand", -37, 175],
    ["GW-44", "Pacific Island", -18, 178],
    ["GW-45", "Japan North", 43, 142],
    ["GW-46", "Central Asia", 43, 76],
    ["GW-47", "Kazakhstan", 51, 71],
    ["GW-48", "Israel", 32, 35],
    ["GW-49", "Ireland", 53, -8],
    ["GW-50", "Iceland", 64, -21],
  ];
  return seedSites.map(
    ([nodeId, name, lat, lon]) =>
      new GroundNode(nodeId, name, lat, lon, GATEWAY_ANTENNAS_PER_SITE * 1500, GATEWAY_ANTENNAS_PER_SITE)
  );
}

function buildWorld(userCount = 80) {
  const satellites = [];
  for (let plane = 0; plane < SATELLITE_PLANES; plane += 1) {
    const inclination = (ONEWEB_INCLINATION_DEG * Math.PI) / 180;
    const raan = (plane * Math.PI) / SATELLITE_PLANES;
    for (let slot = 0; slot < SATELLITES_PER_PLANE; slot += 1) {
      const satId = `LEO-${String(plane + 1).padStart(2, "0")}-${String(slot + 1).padStart(2, "0")}`;
      const anomaly = (slot * Math.PI * 2) / SATELLITES_PER_PLANE;
      satellites.push(new Satellite(satId, anomaly, inclination, raan, plane, slot));
    }
  }
  return {
    satellites,
    gateways: buildGatewaySites(),
    users: Array.from({ length: userCount }, (_, index) => new UserTerminal(index + 1)),
    totalHandovers: 0,
    totalGatewayHandovers: 0,
    events: [`Initialized: ${TOTAL_SATELLITES} satellites, ${SATELLITE_PLANES} planes, ${SATELLITES_PER_PLANE} per plane`],
  };
}

function isVisibleFromGround(groundNode, satellite) {
  const ground = groundNode.position();
  const sat = satellite.position();
  const look = { x: sat.x - ground.x, y: sat.y - ground.y, z: sat.z - ground.z };
  return dot(look, ground) > 0;
}

function planeSeparation(a, b) {
  const raw = Math.abs(a - b);
  return Math.min(raw, SATELLITE_PLANES - raw);
}

function satelliteScore(user, satellite) {
  const planePenalty = user.connectedSat ? 12 * planeSeparation(satellite.planeIndex, user.connectedSat.planeIndex) : 0;
  return distance3(user, satellite) + satellite.utilization() * 180 + planePenalty;
}

function gatewayScore(satellite, gateway, gatewayDiversity) {
  const saturated = gateway.trackedSatellites.size >= gateway.antennaCount && !gateway.trackedSatellites.has(satellite.satId);
  const antennaPenalty = saturated ? 250 : 0;
  const diversityPenalty = gatewayDiversity ? gateway.utilization() * 240 : 0;
  return distance3(satellite, gateway) + diversityPenalty + antennaPenalty;
}

function bestSatelliteForUser(user, satellites) {
  let candidates = satellites.filter(
    (sat) => sat.users.length < USER_BEAMS_PER_SATELLITE && isVisibleFromGround(user, sat)
  );
  if (!candidates.length) {
    candidates = satellites.filter((sat) => sat.users.length < USER_BEAMS_PER_SATELLITE);
  }
  if (!candidates.length) {
    candidates = satellites;
  }

  if (user.connectedSat && candidates.includes(user.connectedSat)) {
    const nearbyPlanes = candidates.filter(
      (sat) => planeSeparation(sat.planeIndex, user.connectedSat.planeIndex) <= 1
    );
    if (nearbyPlanes.length) {
      candidates = nearbyPlanes;
    }
  }

  const best = candidates.reduce((winner, sat) => (satelliteScore(user, sat) < satelliteScore(user, winner) ? sat : winner));
  const current = user.connectedSat;
  if (current && candidates.includes(current) && satelliteScore(user, current) <= satelliteScore(user, best) * SATELLITE_HANDOVER_MARGIN) {
    return current;
  }
  return best;
}

function bestGatewayForSatellite(satellite, gateways, gatewayDiversity) {
  let available = gateways.filter(
    (gateway) =>
      gateway.trackedSatellites.has(satellite.satId) ||
      (gateway.trackedSatellites.size < gateway.antennaCount && isVisibleFromGround(gateway, satellite))
  );
  if (!available.length) {
    available = gateways.filter((gateway) => isVisibleFromGround(gateway, satellite));
  }
  if (!available.length) {
    available = gateways;
  }
  const best = available.reduce((winner, gateway) =>
    gatewayScore(satellite, gateway, gatewayDiversity) < gatewayScore(satellite, winner, gatewayDiversity)
      ? gateway
      : winner
  );
  const current = satellite.gateway;
  if (
    current &&
    available.includes(current) &&
    gatewayScore(satellite, current, gatewayDiversity) <= gatewayScore(satellite, best, gatewayDiversity) * GATEWAY_HANDOVER_MARGIN
  ) {
    return current;
  }
  return best;
}

function runCoreDecisions(world, options) {
  world.satellites.forEach((satellite) => {
    satellite.users = [];
    satellite.loadMbps = 0;
    satellite.gateway = null;
  });
  world.gateways.forEach((gateway) => {
    gateway.loadMbps = 0;
    gateway.trackedSatellites = new Set();
  });

  const users = [...world.users].sort((a, b) =>
    options.qosEnabled ? trafficPriority(b.trafficType) - trafficPriority(a.trafficType) : 0
  );

  users.forEach((user) => {
    if (options.securityEnabled && !user.authenticated) {
      user.connectedSat = null;
      user.connectedGateway = null;
      user.previousGateway = null;
      user.gatewayHandoverTimer = 0;
      user.sessionState = "DENIED";
      user.allocatedMbps = 0;
      return;
    }

    const satellite = bestSatelliteForUser(user, world.satellites);
    const gateway = satellite.gateway || bestGatewayForSatellite(satellite, world.gateways, options.gatewayDiversity);
    user.connectedSat = satellite;
    user.connectedGateway = gateway;

    if (user.lastSatId && user.lastSatId !== satellite.satId) {
      user.handoverCount += 1;
      world.totalHandovers += 1;
      world.events.push(`Beam/SV handover: ${user.nodeId} ${user.lastSatId} -> ${satellite.satId}`);
    }
    if (user.lastGatewayId && user.lastGatewayId !== gateway.nodeId) {
      user.previousGateway = user.lastGatewayId;
      user.gatewayHandoverTimer = MAKE_BEFORE_BREAK_FRAMES;
      user.gatewayHandoverCount += 1;
      world.totalGatewayHandovers += 1;
      world.events.push(`Gateway make-before-break: ${user.nodeId} ${user.lastGatewayId} + ${gateway.nodeId}`);
    } else if (user.gatewayHandoverTimer > 0) {
      user.gatewayHandoverTimer -= 1;
      if (user.gatewayHandoverTimer === 0) {
        user.previousGateway = null;
      }
    }

    user.lastSatId = satellite.satId;
    user.lastGatewayId = gateway.nodeId;
    satellite.users.push(user);
    if (!satellite.gateway) {
      satellite.gateway = gateway;
      gateway.trackedSatellites.add(satellite.satId);
    }

    const allocation = Math.min(
      user.demandMbps,
      Math.max(0, satellite.capacityMbps - satellite.loadMbps),
      Math.max(0, gateway.capacityMbps - gateway.loadMbps)
    );
    user.allocatedMbps = allocation;
    satellite.loadMbps += allocation;
    gateway.loadMbps += allocation;

    const loadPenalty = 22 * Math.max(satellite.utilization(), gateway.utilization());
    const linkDistanceKm = ONEWEB_ALTITUDE_KM + (distance3(user, satellite) + distance3(satellite, gateway)) * 8.5;
    user.latencyMs = clamp((2 * linkDistanceKm * 1000) / 299792 + 12 + loadPenalty, 18, 95);
    user.packetLoss = clamp(((user.demandMbps - allocation) / Math.max(user.demandMbps, 1)) * 4, 0, 12);
    user.sessionState = user.gatewayHandoverTimer > 0 ? "GW-HANDOVER" : allocation > user.demandMbps * 0.72 ? "ACTIVE" : "DEGRADED";
  });

  if (world.events.length > 80) {
    world.events = world.events.slice(-80);
  }
}

function orbitPath(camera, plane, width, height, zoom) {
  const raan = (plane * Math.PI) / SATELLITE_PLANES;
  const inclination = (ONEWEB_INCLINATION_DEG * Math.PI) / 180;
  const points = [];
  for (let step = 0; step <= 96; step += 1) {
    const sat = new Satellite("orbit", (step * Math.PI * 2) / 96, inclination, raan, plane, 0);
    const p = camera.project(sat.position(), width, height, zoom);
    points.push(`${step === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
  }
  return points.join(" ");
}

function useInterval(callback, delay) {
  const savedCallback = useRef(callback);
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);
  useEffect(() => {
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

export default function App() {
  const [layout, setLayout] = useState(Dimensions.get("window"));
  const [running, setRunning] = useState(true);
  const [speedScale, setSpeedScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [tilt, setTilt] = useState(18);
  const [yaw, setYaw] = useState(0);
  const [securityEnabled, setSecurityEnabled] = useState(true);
  const [gatewayDiversity, setGatewayDiversity] = useState(true);
  const [qosEnabled, setQosEnabled] = useState(true);
  const [frame, setFrame] = useState(0);
  const [showPanel, setShowPanel] = useState(Dimensions.get("window").width >= 700);
  const [sceneSize, setSceneSize] = useState({ width: Dimensions.get("window").width, height: Dimensions.get("window").height });
  const worldRef = useRef(buildWorld(80));
  const dragStart = useRef(null);

  const isNarrow = layout.width < 700;

  const camera = useMemo(() => {
    const cam = new Camera();
    cam.yaw = yaw;
    cam.pitch = (tilt * Math.PI) / 180;
    return cam;
  }, [yaw, tilt]);

  const viewWidth = sceneSize.width;
  const viewHeight = sceneSize.height;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStart.current = { yaw, tilt };
        },
        onPanResponderMove: (_event, gesture) => {
          if (!dragStart.current) return;
          setYaw((dragStart.current.yaw + gesture.dx * 0.008) % (Math.PI * 2));
          setTilt(clamp(dragStart.current.tilt - gesture.dy * 0.12, -65, 65));
        },
        onPanResponderRelease: () => {
          dragStart.current = null;
        },
      }),
    [yaw, tilt]
  );

  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) => setLayout(window));
    return () => sub?.remove?.();
  }, []);

  useInterval(() => {
    const world = worldRef.current;
    if (running) {
      world.satellites.forEach((satellite) => satellite.update(speedScale));
      runCoreDecisions(world, { securityEnabled, gatewayDiversity, qosEnabled });
    }
    setFrame((value) => value + 1);
  }, UPDATE_MS);

  const world = worldRef.current;
  const active = world.users.filter((user) => user.sessionState === "ACTIVE");
  const degraded = world.users.filter((user) => user.sessionState === "DEGRADED");
  const gwHandover = world.users.filter((user) => user.sessionState === "GW-HANDOVER");
  const denied = world.users.filter((user) => user.sessionState === "DENIED");
  const totalDemand = world.users.filter((user) => user.sessionState !== "DENIED").reduce((sum, user) => sum + user.demandMbps, 0);
  const totalAllocated = world.users.reduce((sum, user) => sum + user.allocatedMbps, 0);
  const connectedCount = Math.max(1, active.length + degraded.length + gwHandover.length);
  const avgLatency =
    world.users.filter((user) => user.sessionState !== "DENIED").reduce((sum, user) => sum + user.latencyMs, 0) / connectedCount;
  const peakSat = Math.max(...world.satellites.map((satellite) => satellite.utilization()));
  const peakGateway = Math.max(...world.gateways.map((gateway) => gateway.utilization()));
  const selectedUser = world.users.find((user) => user.sessionState !== "DENIED") || world.users[0];

  const project = (nodeOrPoint) => {
    const point = typeof nodeOrPoint.position === "function" ? nodeOrPoint.position() : nodeOrPoint;
    return camera.project(point, viewWidth, viewHeight, zoom);
  };

  const visibleOnFront = (node) => camera.rotate(node.position()).z > -20;

  const resetWorld = () => {
    worldRef.current = buildWorld(80);
    setFrame((value) => value + 1);
  };

  const resetView = () => {
    setYaw(0);
    setTilt(18);
    setZoom(1);
  };

  return (
    <SafeAreaView style={styles.root}>
      <View
        style={styles.scene}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setSceneSize({ width, height });
        }}
        {...panResponder.panHandlers}
      >
        <Svg width={viewWidth} height={viewHeight}>
          <Rect x={0} y={0} width={viewWidth} height={viewHeight} fill="#07111f" />
          {Array.from({ length: 75 }, (_, index) => (
            <Circle
              key={`star-${index}`}
              cx={(index * 97) % viewWidth}
              cy={(index * 53) % viewHeight}
              r={index % 3 === 0 ? 1.2 : 0.7}
              fill={index % 2 === 0 ? "#365b85" : "#5d7899"}
            />
          ))}
          {Array.from({ length: SATELLITE_PLANES }, (_, plane) => (
            <Path
              key={`orbit-${plane}`}
              d={orbitPath(camera, plane, viewWidth, viewHeight, zoom)}
              stroke={ORBIT_PLANE_COLORS[plane % ORBIT_PLANE_COLORS.length]}
              strokeWidth={1}
              fill="none"
            />
          ))}

          {(() => {
            const earth = project({ x: 0, y: 0, z: 0 });
            const r = EARTH_RADIUS * earth.factor;
            return (
              <>
                <Circle cx={earth.x} cy={earth.y} r={r} fill="#1d4ed8" stroke="#93c5fd" strokeWidth={2} />
                <Circle cx={earth.x} cy={earth.y} r={r * 0.64} fill="none" stroke="#60a5fa" strokeWidth={1} />
                <SvgText x={earth.x} y={earth.y - 14} fill="#e0f2fe" fontSize={12} fontWeight="700" textAnchor="middle">
                  OneWeb Core
                </SvgText>
                <SvgText x={earth.x} y={earth.y + 5} fill="#e0f2fe" fontSize={10} textAnchor="middle">
                  {TOTAL_SATELLITES} SV | {GATEWAY_SITE_COUNT} GW
                </SvgText>
                <SvgText x={earth.x} y={earth.y + 23} fill="#e0f2fe" fontSize={10} textAnchor="middle">
                  AAA | QoS | Routing
                </SvgText>
              </>
            );
          })()}

          {world.users.map((user) => {
            if (!user.connectedSat || !user.connectedGateway || (!visibleOnFront(user) && user !== selectedUser)) return null;
            const userP = project(user);
            const satP = project(user.connectedSat);
            return (
              <Line
                key={`user-link-${user.nodeId}`}
                x1={userP.x}
                y1={userP.y}
                x2={satP.x}
                y2={satP.y}
                stroke={user === selectedUser ? trafficColor(user.trafficType) : "#7dd3fc"}
                strokeWidth={user === selectedUser ? 2.5 : 0.8}
              />
            );
          })}

          {world.satellites
            .filter((satellite) => satellite.gateway)
            .map((satellite) => {
              const satP = project(satellite);
              const gwP = project(satellite.gateway);
              return (
                <Line
                  key={`gateway-link-${satellite.satId}`}
                  x1={satP.x}
                  y1={satP.y}
                  x2={gwP.x}
                  y2={gwP.y}
                  stroke="#34d399"
                  strokeWidth={1.3}
                  strokeDasharray="5 4"
                />
              );
            })}

          {[...world.gateways, ...world.users, ...world.satellites]
            .map((node) => ({ node, z: camera.rotate(node.position()).z }))
            .sort((a, b) => a.z - b.z)
            .map(({ node }) => {
              const isSat = node instanceof Satellite;
              const isUser = node instanceof UserTerminal;
              if (!isSat && !visibleOnFront(node)) return null;
              const p = project(node);
              if (isSat) {
                const linked = selectedUser?.connectedSat === node;
                const size = (linked ? 7 : 3) * p.factor + 2;
                return (
                  <Circle
                    key={`sat-${node.satId}`}
                    cx={p.x}
                    cy={p.y}
                    r={size}
                    fill={node.utilization() >= 0.8 ? "#ef4444" : ORBIT_PLANE_COLORS[node.planeIndex % ORBIT_PLANE_COLORS.length]}
                    stroke={linked ? "#ffffff" : "none"}
                    strokeWidth={linked ? 1.5 : 0}
                  />
                );
              }
              if (isUser) {
                const r = (node === selectedUser ? 5 : 3) * p.factor + 2;
                return (
                  <Circle
                    key={`user-${node.nodeId}`}
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    fill={node.sessionState === "DENIED" ? "#111827" : trafficColor(node.trafficType)}
                    stroke={node === selectedUser ? "#ffffff" : "none"}
                  />
                );
              }
              const size = 8 * p.factor + 4;
              return (
                <React.Fragment key={`gateway-${node.nodeId}`}>
                  <Rect
                    x={p.x - size}
                    y={p.y - size}
                    width={size * 2}
                    height={size * 2}
                    fill={node.utilization() < 0.75 ? "#14b8a6" : "#dc2626"}
                    stroke="#ccfbf1"
                    strokeWidth={1}
                  />
                  {node.loadMbps > 0 && (
                    <SvgText x={p.x} y={p.y - size - 6} fill="#ccfbf1" fontSize={8} textAnchor="middle">
                      {node.nodeId}
                    </SvgText>
                  )}
                </React.Fragment>
              );
            })}

          <SvgText x={18} y={28} fill="#e0f2fe" fontSize={13} fontWeight="700">
            OneWeb Core Network 3D Simulator
          </SvgText>
          <SvgText x={18} y={52} fill="#bfdbfe" fontSize={10}>
            {TOTAL_SATELLITES} satellites = {SATELLITE_PLANES} planes x {SATELLITES_PER_PLANE} satellites, equal spacing
          </SvgText>
          <SvgText x={18} y={72} fill="#bfdbfe" fontSize={10}>
            Earth/camera fixed. Satellites rotate along colored orbital paths. Zoom buttons control zoom.
          </SvgText>
          <SvgText x={18} y={viewHeight - 24} fill="#93c5fd" fontSize={10}>
            Drag to rotate camera. Use Zoom In/Out, Left/Right, Tilt, and Speed controls.
          </SvgText>
        </Svg>

        <Pressable
          style={styles.menuButton}
          onPress={() => setShowPanel((v) => !v)}
        >
          <Text style={styles.menuButtonText}>{showPanel ? "✕" : "☰"}</Text>
        </Pressable>
      </View>

      {showPanel && (
      <ScrollView
        style={[
          styles.panel,
          isNarrow && { position: "absolute", right: 0, top: 0, bottom: 0, zIndex: 10 },
        ]}
        contentContainerStyle={styles.panelContent}
      >
        <Text style={styles.title}>OneWeb Core Network</Text>
        <Text style={styles.subtitle}>{TOTAL_SATELLITES} LEO satellites, {GATEWAY_SITE_COUNT} gateway sites</Text>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>Simulation Controls</Text>
          <Button label={running ? "Pause" : "Resume"} onPress={() => setRunning((value) => !value)} />
          <Button label="Reset Topology" onPress={resetWorld} />
          <View style={styles.row}>
            <Button label="Left" onPress={() => setYaw((value) => value - Math.PI / 15)} grow />
            <Button label="Right" onPress={() => setYaw((value) => value + Math.PI / 15)} grow />
          </View>
          <View style={styles.row}>
            <Button label="Zoom In" onPress={() => setZoom((value) => clamp(value * 1.18, 0.45, 2.8))} grow />
            <Button label="Zoom Out" onPress={() => setZoom((value) => clamp(value / 1.18, 0.45, 2.8))} grow />
          </View>
          <Button label="Reset View" onPress={resetView} />
          <View style={styles.row}>
            <Button label="Speed -" onPress={() => setSpeedScale((value) => clamp(value - 0.2, 0.2, 5))} grow />
            <Button label="Speed +" onPress={() => setSpeedScale((value) => clamp(value + 0.2, 0.2, 5))} grow />
          </View>
          <View style={styles.row}>
            <Button label="Tilt -" onPress={() => setTilt((value) => clamp(value - 5, -65, 65))} grow />
            <Button label="Tilt +" onPress={() => setTilt((value) => clamp(value + 5, -65, 65))} grow />
          </View>
          <Toggle label="AAA / security" value={securityEnabled} onPress={() => setSecurityEnabled((value) => !value)} />
          <Toggle label="Gateway diversity" value={gatewayDiversity} onPress={() => setGatewayDiversity((value) => !value)} />
          <Toggle label="QoS policy" value={qosEnabled} onPress={() => setQosEnabled((value) => !value)} />
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>Live Metrics</Text>
          <Metric label="Frame" value={frame} />
          <Metric label="Zoom" value={`${zoom.toFixed(2)}x`} />
          <Metric label="Orbit speed" value={`${speedScale.toFixed(1)}x`} />
          <Metric label="Constellation" value={`${TOTAL_SATELLITES} SV / ${SATELLITE_PLANES} planes`} />
          <Metric label="Per plane" value={`${SATELLITES_PER_PLANE} SV, 6.667 deg spacing`} />
          <Metric label="Sessions" value={`${active.length} active, ${degraded.length} degraded`} />
          <Metric label="GW handover" value={`${gwHandover.length} make-before-break`} />
          <Metric label="AAA denied" value={denied.length} />
          <Metric label="Demand" value={`${totalDemand.toFixed(1)} Mbps`} />
          <Metric label="Allocated" value={`${totalAllocated.toFixed(1)} Mbps`} />
          <Metric label="Avg latency" value={`${avgLatency.toFixed(1)} ms`} />
          <Metric label="Peak SAT load" value={`${(peakSat * 100).toFixed(1)}%`} />
          <Metric label="Peak SNP load" value={`${(peakGateway * 100).toFixed(1)}%`} />
          <Metric label="SV handovers" value={world.totalHandovers} />
          <Metric label="GW handovers" value={world.totalGatewayHandovers} />
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>Selected Session</Text>
          <Metric label="Terminal" value={selectedUser?.nodeId || "--"} />
          <Metric label="Traffic" value={selectedUser?.trafficType || "--"} />
          <Metric label="State" value={selectedUser?.sessionState || "--"} />
          <Metric label="Satellite" value={selectedUser?.connectedSat?.satId || "--"} />
          <Metric
            label="Orbit path"
            value={
              selectedUser?.connectedSat
                ? `Plane ${selectedUser.connectedSat.planeIndex + 1}, slot ${selectedUser.connectedSat.slotIndex + 1}`
                : "--"
            }
          />
          <Metric label="Gateway" value={selectedUser?.connectedGateway?.nodeId || "--"} />
          <Metric label="Demand" value={`${(selectedUser?.demandMbps || 0).toFixed(1)} Mbps`} />
          <Metric label="Latency" value={`${(selectedUser?.latencyMs || 0).toFixed(1)} ms`} />
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>Control Plane Events</Text>
          {world.events.slice(-12).map((event, index) => (
            <Text key={`${event}-${index}`} style={styles.eventText}>
              {event}
            </Text>
          ))}
        </View>
      </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Button({ label, onPress, grow = false }) {
  return (
    <Pressable style={[styles.button, grow && styles.grow]} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function Toggle({ label, value, onPress }) {
  return (
    <Pressable style={styles.toggle} onPress={onPress}>
      <View style={[styles.checkbox, value && styles.checkboxOn]} />
      <Text style={styles.toggleText}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#07111f",
  },
  scene: {
    flex: 1,
    backgroundColor: "#07111f",
    overflow: "hidden",
  },
  panel: {
    width: 170,
    backgroundColor: "#d9d9d9",
    borderLeftWidth: 1,
    borderLeftColor: "#9ca3af",
  },
  menuButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(7,17,31,0.75)",
    borderWidth: 1,
    borderColor: "#60a5fa",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  menuButtonText: {
    color: "#e0f2fe",
    fontSize: 18,
    lineHeight: 22,
  },
  panelContent: {
    padding: 5,
    gap: 4,
  },
  title: {
    fontSize: 10,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 8,
    color: "#1f2937",
  },
  group: {
    borderWidth: 1,
    borderColor: "#9ca3af",
    padding: 4,
    backgroundColor: "#eeeeee",
  },
  groupTitle: {
    fontSize: 9,
    fontWeight: "700",
    marginBottom: 3,
    color: "#111827",
  },
  row: {
    flexDirection: "row",
    gap: 3,
  },
  grow: {
    flex: 1,
  },
  button: {
    minHeight: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#9ca3af",
    backgroundColor: "#f8fafc",
    marginBottom: 3,
    paddingHorizontal: 4,
  },
  buttonText: {
    color: "#111827",
    fontSize: 9,
    fontWeight: "600",
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
  },
  checkbox: {
    width: 9,
    height: 9,
    borderWidth: 1,
    borderColor: "#64748b",
    marginRight: 4,
    backgroundColor: "#ffffff",
  },
  checkboxOn: {
    backgroundColor: "#2563eb",
  },
  toggleText: {
    fontSize: 9,
    color: "#111827",
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
    paddingVertical: 1,
  },
  metricLabel: {
    color: "#111827",
    fontSize: 8,
    fontFamily: "Courier",
  },
  metricValue: {
    color: "#111827",
    fontSize: 8,
    fontFamily: "Courier",
    textAlign: "right",
    flex: 1,
  },
  eventText: {
    color: "#111827",
    fontSize: 7,
    fontFamily: "Courier",
    marginBottom: 2,
  },
});

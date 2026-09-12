import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Line, ContactShadows, Grid } from "@react-three/drei";
import * as THREE from "three";
import type { TopologyGraph, TopologyNode, TopologyNodeHealth, TopologyEdge } from "@kldsim/shared";

const HEALTH_COLOR: Record<TopologyNodeHealth, string> = {
  HEALTHY: "#0ca30c",
  AT_RISK: "#fab219",
  DEGRADED: "#ec835a",
  CRITICAL: "#d03b3b",
};

const SCALE = 1.4;

function nodePosition(node: TopologyNode): [number, number, number] {
  return [node.position.x * SCALE, node.position.y * SCALE, node.position.z * SCALE];
}

function NodeGeometry({ kind }: { kind: TopologyNode["kind"] }) {
  switch (kind) {
    case "APPLICATION":
      return <boxGeometry args={[0.58, 0.58, 0.58]} />;
    case "DATA_STORE":
      return <cylinderGeometry args={[0.32, 0.32, 0.55, 32]} />;
    case "INTEGRATION":
      return <octahedronGeometry args={[0.42, 0]} />;
    case "EXTERNAL_PARTNER":
      return <coneGeometry args={[0.36, 0.62, 32]} />;
    case "CAPABILITY":
    default:
      return <icosahedronGeometry args={[0.38, 1]} />;
  }
}

function NodeMesh({ node, selected, onSelect }: { node: TopologyNode; selected: boolean; onSelect?: (id: string) => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = HEALTH_COLOR[node.health];
  const hot = node.isBottleneck || node.health === "CRITICAL";

  useFrame((state) => {
    if (!meshRef.current) return;
    if (node.isBottleneck) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.06;
      meshRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={nodePosition(node)}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(node.id);
        }}
      >
        <NodeGeometry kind={node.kind} />
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 1.3 : hot ? 0.85 : 0.22}
          roughness={0.55}
          metalness={0.15}
          clearcoat={0.25}
          clearcoatRoughness={0.4}
        />
      </mesh>
      {hot && (
        <mesh>
          <sphereGeometry args={[0.64, 20, 20]} />
          <meshBasicMaterial color={color} transparent opacity={0.1} />
        </mesh>
      )}
      <group position={[0, 0.66, 0]}>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[node.label.length * 0.1 + 0.16, 0.24]} />
          <meshBasicMaterial color="#050810" transparent opacity={0.55} />
        </mesh>
        <Text fontSize={0.2} color="#e2e8f0" anchorX="center" anchorY="middle" font={undefined}>
          {node.label}
        </Text>
      </group>
    </group>
  );
}

function EdgeFlow({ edge, nodes }: { edge: TopologyEdge; nodes: Map<string, TopologyNode> }) {
  const source = nodes.get(edge.source);
  const target = nodes.get(edge.target);
  const pulseRef = useRef<THREE.Mesh>(null);

  const [start, end] = useMemo(() => {
    if (!source || !target) return [null, null];
    return [new THREE.Vector3(...nodePosition(source)), new THREE.Vector3(...nodePosition(target))];
  }, [source, target]);

  const speed = useMemo(() => 1 / Math.max(edge.latencyMs, 50), [edge.latencyMs]);
  const fragile = edge.fragility > 0.6;
  const edgeColor = fragile ? "#e66767" : "#3987e5";

  useFrame((state) => {
    if (!pulseRef.current || !start || !end) return;
    const t = (state.clock.elapsedTime * speed * 400) % 1;
    pulseRef.current.position.lerpVectors(start, end, t);
  });

  if (!start || !end) return null;

  return (
    <>
      <Line points={[start, end]} color={edgeColor} transparent opacity={0.18 + edge.fragility * 0.25} lineWidth={1} />
      <mesh ref={pulseRef}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshBasicMaterial color={edgeColor} toneMapped={false} />
      </mesh>
    </>
  );
}

function Scene({ topology, selectedNodeId, onSelectNode }: { topology: TopologyGraph; selectedNodeId?: string; onSelectNode?: (id: string) => void }) {
  const nodeMap = useMemo(() => new Map(topology.nodes.map((n) => [n.id, n])), [topology.nodes]);

  return (
    <>
      {/*
        No <Environment> here on purpose: drei's HDRI presets fetch from a
        third-party CDN at runtime, which (a) hung one of its mirror requests
        during development, permanently stalling the Suspense boundary and
        blanking the whole scene, and (b) is a real reliability problem for a
        self-hosted product that may run with restricted internet egress.
        hemisphereLight gives a comparable soft sky/ground tint with zero
        network dependency.
      */}
      <color attach="background" args={["#060912"]} />
      <fog attach="fog" args={["#060912", 14, 34]} />
      <hemisphereLight args={["#8bb4ff", "#1a1206", 0.5]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[8, 10, 6]} intensity={1.1} />
      <pointLight position={[-8, -4, -6]} intensity={0.5} color="#3987e5" />

      {topology.edges.map((edge) => (
        <EdgeFlow key={edge.id} edge={edge} nodes={nodeMap} />
      ))}
      {topology.nodes.map((node) => (
        <NodeMesh key={node.id} node={node} selected={node.id === selectedNodeId} onSelect={onSelectNode} />
      ))}

      <Grid
        position={[0, -1.3, 0]}
        args={[40, 40]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1b2842"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#2c3e63"
        fadeDistance={26}
        fadeStrength={1.5}
        infiniteGrid
      />
      <ContactShadows position={[0, -1.29, 0]} opacity={0.4} scale={24} blur={2.4} far={4} color="#000000" />

      <OrbitControls enablePan enableZoom enableRotate minDistance={4} maxDistance={30} autoRotate autoRotateSpeed={0.4} maxPolarAngle={Math.PI / 1.9} />
    </>
  );
}

export function TopologyCanvas({
  topology,
  selectedNodeId,
  onSelectNode,
  height = 420,
}: {
  topology: TopologyGraph;
  selectedNodeId?: string;
  onSelectNode?: (id: string) => void;
  height?: number;
}) {
  const [mountKey, setMountKey] = useState(0);
  const [lost, setLost] = useState(false);

  if (lost) {
    return (
      <div style={{ height }} className="flex flex-col items-center justify-center gap-3 rounded-lg border border-surface-border bg-[#070c16] text-sm text-slate-400">
        <p>The 3D view lost its graphics context (common with many browser tabs open or a GPU driver hiccup).</p>
        <button
          onClick={() => {
            setLost(false);
            setMountKey((k) => k + 1);
          }}
          className="rounded-md border border-surface-border px-3 py-1.5 text-slate-200 hover:bg-white/5"
        >
          Reload 3D view
        </button>
      </div>
    );
  }

  return (
    <div style={{ height }} className="overflow-hidden rounded-lg border border-surface-border bg-[#060912] shadow-[inset_0_0_60px_rgba(0,0,0,0.5)]">
      <Canvas
        key={mountKey}
        dpr={[1, 1.5]}
        camera={{ position: [8, 6, 10], fov: 50 }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener(
            "webglcontextlost",
            (event) => {
              event.preventDefault();
              setLost(true);
            },
            { once: true },
          );
        }}
      >
        <Scene topology={topology} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} />
      </Canvas>
    </div>
  );
}

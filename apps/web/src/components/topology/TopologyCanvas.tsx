import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Line } from "@react-three/drei";
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
      return <boxGeometry args={[0.55, 0.55, 0.55]} />;
    case "DATA_STORE":
      return <cylinderGeometry args={[0.32, 0.32, 0.55, 20]} />;
    case "INTEGRATION":
      return <octahedronGeometry args={[0.4]} />;
    case "EXTERNAL_PARTNER":
      return <coneGeometry args={[0.35, 0.6, 24]} />;
    case "CAPABILITY":
    default:
      return <icosahedronGeometry args={[0.36, 0]} />;
  }
}

function NodeMesh({ node, selected, onSelect }: { node: TopologyNode; selected: boolean; onSelect?: (id: string) => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = HEALTH_COLOR[node.health];

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
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 0.9 : node.isBottleneck ? 0.5 : 0.2}
          roughness={0.4}
          metalness={0.15}
        />
      </mesh>
      {node.isBottleneck && (
        <mesh>
          <sphereGeometry args={[0.62, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.12} />
        </mesh>
      )}
      <Text position={[0, 0.65, 0]} fontSize={0.22} color="#e2e8f0" anchorX="center" anchorY="bottom" outlineWidth={0.01} outlineColor="#0b1220">
        {node.label}
      </Text>
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

  useFrame((state) => {
    if (!pulseRef.current || !start || !end) return;
    const t = (state.clock.elapsedTime * speed * 400) % 1;
    pulseRef.current.position.lerpVectors(start, end, t);
  });

  if (!start || !end) return null;
  const fragile = edge.fragility > 0.6;

  return (
    <>
      <Line points={[start, end]} color={fragile ? "#d03b3b" : "#3987e5"} transparent opacity={0.25 + edge.fragility * 0.3} lineWidth={1} />
      <mesh ref={pulseRef}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color={fragile ? "#ec835a" : "#3987e5"} />
      </mesh>
    </>
  );
}

function Scene({ topology, selectedNodeId, onSelectNode }: { topology: TopologyGraph; selectedNodeId?: string; onSelectNode?: (id: string) => void }) {
  const nodeMap = useMemo(() => new Map(topology.nodes.map((n) => [n.id, n])), [topology.nodes]);

  return (
    <>
      <ambientLight intensity={0.55} />
      <pointLight position={[10, 12, 8]} intensity={1.1} />
      <pointLight position={[-10, -6, -8]} intensity={0.4} color="#3987e5" />
      {topology.edges.map((edge) => (
        <EdgeFlow key={edge.id} edge={edge} nodes={nodeMap} />
      ))}
      {topology.nodes.map((node) => (
        <NodeMesh key={node.id} node={node} selected={node.id === selectedNodeId} onSelect={onSelectNode} />
      ))}
      <OrbitControls enablePan enableZoom enableRotate minDistance={4} maxDistance={30} />
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
    <div style={{ height }} className="overflow-hidden rounded-lg border border-surface-border bg-[#070c16]">
      <Canvas
        key={mountKey}
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

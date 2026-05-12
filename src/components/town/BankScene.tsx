/**
 * 银行 3D 内景 —— 客户在柜台、玩家拖钱币到托盘。
 *
 * 实现说明：
 *  - R3F 3D 场景：柜台 / 客户 / 钱币堆 / 托盘
 *  - 钱币是 cylinder 加 emoji 文字标签（HTML overlay 用 drei <Html>）
 *  - 用 onClick on coin 来"加一个"到托盘（不真做 drag，因为 mobile 拖动复杂）
 *  - 托盘累加 → 显示当前总和
 *  - 配 HTML 顶部 banner "客户：xx" + 实时 总和 / 目标 进度
 *  - 总和 == target 触发完成回调
 */
import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  COIN_COLOR,
  COIN_LABEL,
  COIN_VALUES,
  type BankTask,
  type CoinValue,
} from "../../content/town/bankTasks";

interface Props {
  task: BankTask;
  /** 当前托盘上的钱币：Map<面额, 个数> */
  tray: Map<CoinValue, number>;
  /** 玩家点了某个面额的钱币（+1） */
  onPickCoin: (v: CoinValue) => void;
  /** 玩家点了托盘里的钱币（-1） */
  onReturnCoin: (v: CoinValue) => void;
  /** 实时总和（元） */
  total: number;
  /** 完成状态：null = 还在做；'win' = 总和 == target */
  status: null | "win";
}

export function BankScene(props: Props) {
  return (
    <Canvas
      camera={{ position: [0, 5.5, 9], fov: 42 }}
      shadows
      gl={{ alpha: false, antialias: true }}
    >
      <color attach="background" args={["#1e293b"]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 8, 6]} intensity={1.0} color="#fef3c7" castShadow />
      <directionalLight position={[-3, 4, -2]} intensity={0.3} color="#bae6fd" />
      <Environment preset="city" />

      {/* 地板 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.6} />
      </mesh>

      {/* 后墙 */}
      <mesh position={[0, 2.5, -4]}>
        <planeGeometry args={[14, 5]} />
        <meshStandardMaterial color="#fef3c7" roughness={0.9} />
      </mesh>
      {/* 装饰：墙上"银行"招牌 — 移到墙的上沿，不挡客户对话 */}
      <Html position={[-2.6, 3.7, -3.95]} center distanceFactor={6}>
        <div className="px-3 py-1 rounded-xl bg-amber-600 text-amber-50 font-bold text-xs shadow-xl border border-amber-700 select-none whitespace-nowrap">
          🏦 村庄银行
        </div>
      </Html>

      {/* 柜台（长 box） */}
      <mesh position={[0, 0.7, -1.2]} castShadow receiveShadow>
        <boxGeometry args={[8, 1.4, 1.0]} />
        <meshStandardMaterial color="#78350f" roughness={0.5} />
      </mesh>
      {/* 柜台台面 */}
      <mesh position={[0, 1.41, -1.2]} receiveShadow>
        <boxGeometry args={[8.2, 0.04, 1.1]} />
        <meshStandardMaterial color="#fef3c7" roughness={0.3} metalness={0.1} />
      </mesh>

      {/* 客户（柜台后面） */}
      <CustomerNPC emoji={props.task.customer} />

      {/* 托盘（柜台中央） */}
      <Tray totalCoins={[...props.tray.values()].reduce((a, b) => a + b, 0)} status={props.status} />

      {/* 钱币堆（柜台前 6 摞，玩家点击） */}
      <CoinPile onPickCoin={props.onPickCoin} />

      {/* 客户对话气泡 — 放右上角，避免遮住 NPC 和托盘 */}
      <Html position={[2.5, 3.0, -1.5]} center distanceFactor={5.5}>
        <div className="px-3 py-2 rounded-2xl bg-white text-slate-800 max-w-[200px] text-xs font-medium shadow-2xl border-2 border-amber-300 select-none">
          <div className="text-[9px] text-slate-500 mb-0.5">客户说</div>
          {props.task.question}
        </div>
      </Html>

      {/* 中央托盘 HTML：总和 + 已放钱币列表 */}
      <Html position={[0, 1.9, -1.2]} center distanceFactor={6}>
        <TrayBadge tray={props.tray} total={props.total} target={props.task.target} status={props.status} onReturnCoin={props.onReturnCoin} />
      </Html>

      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={5}
        maxDistance={11}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.1}
      />
    </Canvas>
  );
}

function CustomerNPC({ emoji }: { emoji: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.position.y = 1.6 + Math.sin(t * 1.4) * 0.06;
    ref.current.rotation.y = Math.sin(t * 0.5) * 0.1;
  });
  return (
    <group ref={ref} position={[-2, 2.0, -2.0]}>
      <Html center distanceFactor={2.5} transform={false}>
        <div className="text-8xl select-none drop-shadow-2xl">{emoji}</div>
      </Html>
    </group>
  );
}

function Tray({ totalCoins, status }: { totalCoins: number; status: null | "win" }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    if (status === "win") {
      const t = state.clock.getElapsedTime();
      ref.current.position.y = 1.5 + Math.sin(t * 6) * 0.05;
    } else {
      ref.current.position.y = 1.5;
    }
  });
  return (
    <mesh ref={ref} position={[0, 1.5, -1.2]} castShadow>
      <cylinderGeometry args={[0.8, 0.9, 0.12, 24]} />
      <meshStandardMaterial
        color={status === "win" ? "#fde047" : "#cbd5e1"}
        roughness={0.4}
        emissive={status === "win" ? "#fbbf24" : "#000"}
        emissiveIntensity={status === "win" ? 1.5 : 0}
      />
    </mesh>
  );
}

function CoinPile({ onPickCoin }: { onPickCoin: (v: CoinValue) => void }) {
  // 6 个面额排在柜台前方的 2 排 x 3 列
  const layout: { v: CoinValue; pos: [number, number, number] }[] = [
    { v: 10, pos: [-2.5, 0.55, 1.3] },
    { v: 5, pos: [-1.5, 0.55, 1.3] },
    { v: 1, pos: [-0.5, 0.55, 1.3] },
    { v: 0.5, pos: [0.5, 0.55, 1.3] },
    { v: 0.1, pos: [1.5, 0.55, 1.3] },
    { v: 0.05, pos: [2.5, 0.55, 1.3] },
  ];
  return (
    <>
      {layout.map((c) => (
        <CoinStack key={c.v} value={c.v} pos={c.pos} onClick={() => onPickCoin(c.v)} />
      ))}
    </>
  );
}

function CoinStack({
  value,
  pos,
  onClick,
}: {
  value: CoinValue;
  pos: [number, number, number];
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.scale.x += (hovered ? 1.1 : 1) - ref.current.scale.x;
    ref.current.scale.y += (hovered ? 1.1 : 1) - ref.current.scale.y;
    ref.current.scale.z += (hovered ? 1.1 : 1) - ref.current.scale.z;
  });
  return (
    <group
      ref={ref}
      position={pos}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "default";
      }}
    >
      {/* 3 摞硬币堆叠 */}
      {[0, 0.1, 0.2].map((y, i) => (
        <mesh key={i} position={[0, y, 0]} castShadow>
          <cylinderGeometry args={[0.32, 0.32, 0.09, 24]} />
          <meshStandardMaterial color={COIN_COLOR[value]} roughness={0.3} metalness={0.6} />
        </mesh>
      ))}
      {/* HTML 标签 */}
      <Html position={[0, 0.6, 0]} center distanceFactor={5}>
        <div className="px-2 py-0.5 rounded-md bg-black/70 text-white text-xs font-bold select-none whitespace-nowrap pointer-events-none">
          {COIN_LABEL[value]}
        </div>
      </Html>
    </group>
  );
}

function TrayBadge({
  tray,
  total,
  target,
  status,
  onReturnCoin,
}: {
  tray: Map<CoinValue, number>;
  total: number;
  target: number;
  status: null | "win";
  onReturnCoin: (v: CoinValue) => void;
}) {
  const diff = Math.round((target - total) * 100) / 100;
  return (
    <div className="rounded-2xl px-3 py-2 bg-black/85 backdrop-blur text-white text-xs font-medium shadow-2xl border-2 select-none min-w-[200px]"
      style={{ borderColor: status === "win" ? "#fcd34d" : "#475569" }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-slate-400 text-[10px]">已凑</span>
        <span className="font-mono text-base text-amber-300 tabular-nums">¥{total.toFixed(2)}</span>
      </div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-slate-400 text-[10px]">目标</span>
        <span className="font-mono text-sm text-slate-200 tabular-nums">¥{target.toFixed(2)}</span>
      </div>
      {status === "win" ? (
        <div className="text-amber-300 text-center font-bold text-sm">✨ 正好！</div>
      ) : diff > 0 ? (
        <div className="text-slate-400 text-center text-[10px]">还差 ¥{diff.toFixed(2)}</div>
      ) : (
        <div className="text-rose-300 text-center text-[10px]">超了 ¥{(-diff).toFixed(2)} —— 点托盘上的钱币移回</div>
      )}

      {/* 托盘里已有的钱币（点击移回） */}
      {tray.size > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-white/10">
          {[...tray.entries()].map(([v, n]) => (
            <button
              key={v}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReturnCoin(v);
              }}
              className="px-1.5 py-0.5 rounded-md text-[10px] font-bold hover:bg-white/10"
              style={{ backgroundColor: COIN_COLOR[v] + "30", color: COIN_COLOR[v] }}
            >
              {COIN_LABEL[v]} × {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

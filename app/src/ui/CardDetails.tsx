// Small instrument details inside the soft cards, like the references: a tick gauge, a curve with points,
// and bars. Plain views (no canvas), sized to the card through onLayout.
import { useState, type ReactNode } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";

export type CardDetail = "gauge" | "curve" | "bars";

function Sized({ children }: { children: (w: number, h: number) => ReactNode }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {size.w > 0 ? children(size.w, size.h) : null}
    </View>
  );
}

/** An arc of fine ticks over the top half with one bright needle in the middle. */
function Gauge({ color }: { color: string }) {
  return (
    <Sized>
      {(w, h) => {
        // The arc stays inside the card: radius and sweep keep the outer ticks clear of the rounded edge.
        const R = w * 0.5;
        const cx = w / 2;
        const cy = h * 0.3 + R;
        const ticks = 41;
        return Array.from({ length: ticks }, (_, i) => {
          const a = ((i / (ticks - 1)) * 2 - 1) * 0.85;
          const needle = i === (ticks - 1) / 2;
          const len = needle ? 28 : i % 5 === 0 ? 10 : 6;
          const x = cx + R * Math.sin(a);
          const y = cy - R * Math.cos(a);
          return (
            <View
              key={i}
              style={{
                position: "absolute",
                left: x - 0.75,
                top: y - (needle ? len : 0),
                width: needle ? 1.5 : 1,
                height: len,
                borderRadius: 1,
                backgroundColor: needle ? "#FFFFFF" : color,
                opacity: needle ? 0.9 : 0.35 + 0.35 * (1 - Math.abs(a)),
                transform: [{ rotate: `${a}rad` }],
              }}
            />
          );
        });
      }}
    </Sized>
  );
}

const CURVE = [0.62, 0.42, 0.5, 0.28, 0.36, 0.12];

/** A smooth-looking line through a few points, each with a glowing dot and a thin drop line. */
function Curve({ color }: { color: string }) {
  return (
    <Sized>
      {(w, h) => {
        const pts = CURVE.map((v, i) => ({ x: w * (0.08 + (i / (CURVE.length - 1)) * 0.84), y: h * (0.18 + v * 0.5) }));
        return (
          <>
            {pts.slice(1).map((p, i) => {
              const q = pts[i];
              const len = Math.hypot(p.x - q.x, p.y - q.y);
              const ang = Math.atan2(p.y - q.y, p.x - q.x);
              return (
                <View
                  key={`l${i}`}
                  style={{ position: "absolute", left: (q.x + p.x) / 2 - len / 2, top: (q.y + p.y) / 2 - 0.75, width: len, height: 1.5, borderRadius: 1, backgroundColor: color, opacity: 0.85, transform: [{ rotate: `${ang}rad` }] }}
                />
              );
            })}
            {pts.map((p, i) => (
              <View key={`d${i}`}>
                <View style={{ position: "absolute", left: p.x - 0.5, top: p.y, width: 1, height: h * 0.72 - p.y, backgroundColor: color, opacity: 0.18 }} />
                {i % 2 === 1 && <View style={{ position: "absolute", left: p.x - 4, top: p.y - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFFFFF", boxShadow: `0 0 10px ${color}` }} />}
              </View>
            ))}
          </>
        );
      }}
    </Sized>
  );
}

const BARS = [0.35, 0.22, 0.5, 0.62, 0.48, 0.7, 0.3, 0.14, 0.55, 0.72, 0.6, 0.4];

/** A row of soft bars, brighter toward the middle. */
function Bars({ color, values = BARS }: { color: string; values?: number[] }) {
  return (
    <Sized>
      {(w, h) => {
        const gap = 5;
        const bw = (w * 0.84 - gap * (values.length - 1)) / values.length;
        const base = h * 0.66;
        return values.map((v, i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              left: w * 0.08 + i * (bw + gap),
              top: base - Math.max(4, v * h * 0.42),
              width: bw,
              height: Math.max(4, v * h * 0.42),
              borderRadius: 3,
              backgroundColor: i === values.length - 1 ? "#FFFFFF" : color,
              opacity: i === values.length - 1 ? 0.9 : 0.25 + v * 0.5,
            }}
          />
        ));
      }}
    </Sized>
  );
}

export function Detail({ kind, color, values }: { kind: CardDetail; color: string; values?: number[] }) {
  if (kind === "gauge") return <Gauge color={color} />;
  if (kind === "curve") return <Curve color={color} />;
  return <Bars color={color} values={values} />;
}

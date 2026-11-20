import { useId } from "react";

const sk = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const fl = { fill: "currentColor", stroke: "none" };

function P({ pts, w }: { pts: [number, number][]; w?: number }) {
  return <polyline points={pts.map((p) => p.join(",")).join(" ")} {...sk} {...(w ? { strokeWidth: w } : {})} />;
}

/** The desktop program's icons, drawn on the same 24-unit grid with the same stroke. */
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const id = useId();
  let body: JSX.Element;
  switch (name) {
    case "lock":
    case "unlock": {
      const on = name === "lock";
      body = (
        <>
          <mask id={id}>
            <rect width="24" height="24" fill="#fff" />
            <ellipse cx="12" cy="15.8" rx="1.6" ry="1.6" fill="#000" />
            <rect x="11.2" y="16" width="1.6" height="2.6" fill="#000" />
          </mask>
          {on ? <path d="M7.5 7.2A4.5 5 0 0 1 16.5 7.2M7.5 7.2V11.5M16.5 7.2V11.5" {...sk} /> : <path d="M7.5 5.6A4.5 5 0 0 1 16.5 5.6M7.5 5.6V11.5M16.5 5.6V7.4" {...sk} />}
          <rect x="5" y="11" width="14" height="10.5" rx="2.6" {...fl} mask={`url(#${id})`} />
        </>
      );
      break;
    }
    case "sparkle":
      body = (<g {...fl}><polygon points="10,3 12.2,9.8 19,12 12.2,14.2 10,21 7.8,14.2 1,12 7.8,9.8" /><polygon points="19,2 20.1,5 23,6 20.1,7 19,10 17.9,7 15,6 17.9,5" /></g>);
      break;
    case "download": body = (<><P pts={[[12, 3.5], [12, 14.5]]} /><P pts={[[7, 10], [12, 15], [17, 10]]} /><P pts={[[4.5, 15.5], [4.5, 19.5], [19.5, 19.5], [19.5, 15.5]]} /></>); break;
    case "back": body = (<><P pts={[[14.5, 5], [7.5, 12], [14.5, 19]]} /><P pts={[[8, 12], [19, 12]]} /></>); break;
    case "palette": body = (<><circle cx="12" cy="12" r="9" {...sk} /><g {...fl}><circle cx="8" cy="10.5" r="1.5" /><circle cx="12" cy="7.5" r="1.5" /><circle cx="16" cy="10.5" r="1.5" /><circle cx="12" cy="16" r="1.5" /></g></>); break;
    case "gradient": body = (<><rect x="3" y="4.5" width="18" height="15" rx="3" {...sk} />{[8, 12, 16].map((x) => <P key={x} pts={[[x, 8], [x, 16]]} w={1.3} />)}</>); break;
    case "layers": body = (<><P pts={[[12, 3.5], [21, 8], [12, 12.5], [3, 8], [12, 3.5]]} /><P pts={[[3, 12], [12, 16.5], [21, 12]]} /><P pts={[[3, 16], [12, 20.5], [21, 16]]} /></>); break;
    case "reset": body = (<><path d="M17.745 16.821A7.5 7.5 0 1 1 18.495 8.25" {...sk} strokeLinecap="butt" /><polygon points="20.5,3.5 20.5,10.5 13.5,9" {...fl} /></>); break;
    case "info": body = (<><circle cx="12" cy="12" r="9" {...sk} /><circle cx="12" cy="7.6" r="1.25" {...fl} /><P pts={[[12, 11], [12, 17]]} /></>); break;
    case "help": body = (<><circle cx="12" cy="12" r="9" {...sk} /><text x="12" y="16.6" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor" stroke="none">?</text></>); break;
    case "theme": body = (<><circle cx="12" cy="12" r="9" {...sk} /><path d="M12 3A9 9 0 0 1 12 21Z" {...fl} /></>); break;
    case "bookmark": body = <P pts={[[7, 3.5], [17, 3.5], [17, 20.5], [12, 16], [7, 20.5], [7, 3.5]]} />; break;
    case "copy": body = (<><P pts={[[14.5, 4.5], [4.5, 4.5], [4.5, 14.5]]} /><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.4" {...sk} /></>); break;
    case "image": body = (<><rect x="3.5" y="4.5" width="17" height="15" rx="2.6" {...sk} /><circle cx="9" cy="9.6" r="1.5" {...fl} /><P pts={[[3.8, 17], [9.2, 12.2], [13, 15.4], [16, 12.8], [20.2, 16.6]]} /></>); break;
    case "gear": body = (<><circle cx="12" cy="12" r="6.4" {...sk} /><circle cx="12" cy="12" r="2.6" {...sk} />{Array.from({ length: 8 }, (_, k) => { const a = (k * Math.PI) / 4; return <P key={k} pts={[[12 + 6.4 * Math.cos(a), 12 + 6.4 * Math.sin(a)], [12 + 9.4 * Math.cos(a), 12 + 9.4 * Math.sin(a)]]} />; })}</>); break;
    case "expand": body = (<>{[[[4, 9], [4, 4], [9, 4]], [[15, 4], [20, 4], [20, 9]], [[4, 15], [4, 20], [9, 20]], [[15, 20], [20, 20], [20, 15]]].map((p, i) => <P key={i} pts={p as [number, number][]} />)}</>); break;
    case "chevron": body = <P pts={[[7, 9.5], [12, 14.5], [17, 9.5]]} />; break;
    case "dice": body = (<><rect x="3.5" y="3.5" width="17" height="17" rx="4.2" {...sk} /><g {...fl}>{[[8.6, 8.6], [15.4, 8.6], [12, 12], [8.6, 15.4], [15.4, 15.4]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.45" />)}</g></>); break;
    case "star":
    case "star_fill": {
      const pts = Array.from({ length: 10 }, (_, k) => { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 === 0 ? 9.4 : 4.1; return [12 + r * Math.cos(a), 12.8 + r * Math.sin(a)] as [number, number]; });
      body = name === "star_fill" ? <polygon points={pts.map((p) => p.join(",")).join(" ")} {...fl} /> : <P pts={[...pts, pts[0]]} w={1.6} />;
      break;
    }
    case "undo":
    case "redo":
      body = (
        <g transform={name === "redo" ? "translate(24 0) scale(-1 1)" : undefined}>
          <P pts={[[14, 7.5], [8, 7.5]]} /><P pts={[[14, 20.5], [8, 20.5]]} />
          <path d="M14 7.5A6.5 6.5 0 0 1 14 20.5" {...sk} strokeLinecap="butt" />
          <polygon points="2.6,7.5 8.6,3 8.6,12" {...fl} />
        </g>
      );
      break;
    default: body = <></>;
  }
  return (<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{body}</svg>);
}

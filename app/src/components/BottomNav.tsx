"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from "framer-motion";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { MORE_TAB, TAB_ITEMS, getActiveTab, type NavIcon } from "@/components/nav/nav-config";
import { LIQUID_SPRING } from "@/lib/motion";
import { useScrollDirection } from "@/hooks/useScrollDirection";

const SLOTS = [...TAB_ITEMS, MORE_TAB];
const MORE_INDEX = SLOTS.length - 1;
const BAR_HEIGHT = 62;
const BAR_HEIGHT_COMPACT = 50;
const PILL_INSET_X = 2;
const SCRUB_THRESHOLD_PX = 8;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

interface BottomNavProps {
  onMoreClick: () => void;
  onSearchClick: () => void;
  moreOpen: boolean;
  keyboardOpen: boolean;
}

interface TabGlyphProps {
  index: number;
  icon: NavIcon;
  label: string;
  highlighted: boolean;
  compact: boolean;
  lensX: MotionValue<number>;
  slotWidth: MotionValue<number>;
  magnify: MotionValue<number>;
}

function TabGlyph({ index, icon: Icon, label, highlighted, compact, lensX, slotWidth, magnify }: TabGlyphProps) {
  // Icons swell as the lens passes over them while scrubbing
  const scale = useTransform([lensX, slotWidth, magnify], ([lens, width, amount]: number[]) => {
    if (!width || !amount) return 1;
    const distance = Math.abs(lens - index * width) / width;
    return 1 + 0.22 * amount * Math.max(0, 1 - distance);
  });

  return (
    <motion.span
      style={{ scale }}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 transition-colors duration-200",
        highlighted ? "text-brand" : "text-foreground/75"
      )}
    >
      <Icon className="size-6" strokeWidth={highlighted ? 2.25 : 1.75} />
      <span
        className={cn(
          "overflow-hidden text-[10px] font-semibold leading-3 tracking-[0.01em] transition-[opacity,max-height] duration-300",
          compact ? "max-h-0 opacity-0" : "max-h-3 opacity-100"
        )}
      >
        {label}
      </span>
    </motion.span>
  );
}

/**
 * Floating iOS 26-style Liquid Glass tab bar: a glass lens slides (and stretches)
 * between tabs, can be dragged across them, and the bar shrinks while scrolling down.
 */
export default function BottomNav({ onMoreClick, onSearchClick, moreOpen, keyboardOpen }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion() ?? false;
  const { direction, atTop, atBottom } = useScrollDirection();

  const activeTab = getActiveTab(pathname);
  const routeIndex = SLOTS.findIndex((slot) => slot.id === activeTab);
  const selectedIndex = moreOpen ? MORE_INDEX : routeIndex;

  const barRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ pointerId: number; startX: number; scrubbing: boolean } | null>(null);
  const suppressClick = useRef(false);
  const hasPositioned = useRef(false);
  const [slotWidth, setSlotWidth] = useState(0);
  const [pressed, setPressed] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [lensIndex, setLensIndex] = useState<number | null>(null);

  const slotWidthValue = useMotionValue(0);
  const lensX = useSpring(0, LIQUID_SPRING);
  const velocity = useVelocity(lensX);
  const stretchX = useTransform(velocity, [-1800, 0, 1800], [1.2, 1, 1.2]);
  const stretchY = useTransform(velocity, [-1800, 0, 1800], [0.88, 1, 0.88]);
  const magnify = useSpring(0, LIQUID_SPRING);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width / SLOTS.length;
      setSlotWidth(width);
      slotWidthValue.set(width);
    });
    observer.observe(bar);
    return () => observer.disconnect();
  }, [slotWidthValue]);

  useEffect(() => {
    if (!slotWidth || gesture.current?.scrubbing) return;
    const next = selectedIndex * slotWidth;
    if (!hasPositioned.current || reduceMotion) {
      lensX.jump(next);
      hasPositioned.current = true;
    } else {
      lensX.set(next);
    }
  }, [selectedIndex, slotWidth, reduceMotion, lensX]);

  useEffect(() => {
    magnify.set(scrubbing && !reduceMotion ? 1 : 0);
  }, [scrubbing, reduceMotion, magnify]);

  const compact = direction === "down" && !atTop && !atBottom && !pressed && !scrubbing && !moreOpen;
  const barHeight = compact ? BAR_HEIGHT_COMPACT : BAR_HEIGHT;

  const indexAt = (clientX: number, rect: DOMRect) =>
    clamp(Math.floor((clientX - rect.left) / slotWidth), 0, SLOTS.length - 1);

  const activate = (index: number) => {
    const slot = SLOTS[index];
    if ("href" in slot) router.push(slot.href);
    else onMoreClick();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || !slotWidth) return;
    suppressClick.current = false;
    gesture.current = { pointerId: event.pointerId, startX: event.clientX, scrubbing: false };
    setPressed(true);
    lensX.set(indexAt(event.clientX, event.currentTarget.getBoundingClientRect()) * slotWidth);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.scrubbing) {
      if (Math.abs(event.clientX - current.startX) < SCRUB_THRESHOLD_PX) return;
      current.scrubbing = true;
      // Capture only once scrubbing starts so plain taps still click the tab link
      event.currentTarget.setPointerCapture(event.pointerId);
      setScrubbing(true);
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const position = clamp(event.clientX - rect.left - slotWidth / 2, 0, slotWidth * (SLOTS.length - 1));
    lensX.set(position);
    setLensIndex(Math.round(position / slotWidth));
  };

  const endGesture = (event: React.PointerEvent<HTMLDivElement>, commit: boolean) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    setPressed(false);

    if (!current.scrubbing) {
      if (!commit) lensX.set(selectedIndex * slotWidth);
      return;
    }

    suppressClick.current = true;
    setScrubbing(false);
    setLensIndex(null);
    const rect = event.currentTarget.getBoundingClientRect();
    const released = clamp(Math.round((event.clientX - rect.left - slotWidth / 2) / slotWidth), 0, SLOTS.length - 1);
    const destination = commit ? released : selectedIndex;
    lensX.set(destination * slotWidth);
    if (destination !== selectedIndex) activate(destination);
  };

  const handlePointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
    // Mouse dragged off the bar before scrubbing: treat as a cancelled press
    if (gesture.current && !gesture.current.scrubbing) endGesture(event, false);
  };

  const handleTabClick = (event: React.MouseEvent, href: string) => {
    if (pathname !== href) return;
    // Tapping the current tab scrolls back to the top, like iOS
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  const lifted = pressed || scrubbing;

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-[calc(var(--safe-bottom)_+_96px)] bg-gradient-to-t from-background/80 via-background/35 to-transparent md:hidden"
      />
      <nav
        aria-label="Primary"
        inert={keyboardOpen}
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(12px,calc(var(--safe-bottom)_-_6px))] transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] md:hidden",
          keyboardOpen && "translate-y-[calc(100%_+_16px)] opacity-0"
        )}
      >
        <div className="pointer-events-auto mx-auto flex max-w-[460px] items-center gap-2.5">
          <div
            ref={barRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={(event) => endGesture(event, true)}
            onPointerCancel={(event) => endGesture(event, false)}
            onPointerLeave={handlePointerLeave}
            onClickCapture={(event) => {
              if (!suppressClick.current) return;
              suppressClick.current = false;
              event.preventDefault();
              event.stopPropagation();
            }}
            className="glass-chrome relative flex flex-1 touch-none select-none rounded-full transition-[height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] [-webkit-touch-callout:none]"
            style={{ height: barHeight }}
          >
            <motion.div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-y-1 left-0 rounded-full transition-[background-color,box-shadow,opacity] duration-200",
                lifted ? "glass-lens z-20" : "glass-pill z-0",
                slotWidth ? "opacity-100" : "opacity-0"
              )}
              style={{
                x: lensX,
                marginLeft: PILL_INSET_X,
                width: Math.max(slotWidth - PILL_INSET_X * 2, 0),
                scaleX: reduceMotion ? 1 : stretchX,
                scaleY: reduceMotion ? 1 : stretchY,
              }}
              animate={{ scale: reduceMotion ? 1 : scrubbing ? 1.16 : pressed ? 1.06 : 1 }}
              transition={{ type: "spring", ...LIQUID_SPRING }}
            />

            {SLOTS.map((slot, index) => {
              const glyph = (
                <TabGlyph
                  index={index}
                  icon={slot.icon}
                  label={slot.label}
                  highlighted={scrubbing ? index === lensIndex : index === selectedIndex}
                  compact={compact}
                  lensX={lensX}
                  slotWidth={slotWidthValue}
                  magnify={magnify}
                />
              );
              const slotClass = "relative z-10 flex h-full flex-1 cursor-pointer items-center justify-center rounded-full";

              if (!("href" in slot)) {
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={onMoreClick}
                    aria-haspopup="dialog"
                    aria-expanded={moreOpen}
                    className={slotClass}
                  >
                    {glyph}
                  </button>
                );
              }

              return (
                <Link
                  key={slot.id}
                  href={slot.href}
                  draggable={false}
                  onClick={(event) => handleTabClick(event, slot.href)}
                  aria-current={!moreOpen && index === routeIndex ? "page" : undefined}
                  className={slotClass}
                >
                  {glyph}
                </Link>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onSearchClick}
            aria-label="Search"
            className="glass-chrome grid shrink-0 cursor-pointer place-items-center rounded-full text-foreground/80 transition-[width,height,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95"
            style={{ width: barHeight, height: barHeight }}
          >
            <Search className="size-[22px]" strokeWidth={2} />
          </button>
        </div>
      </nav>
    </>
  );
}

import {
  createElement, Antenna, Archive, Ban, Bird, Bone, Bot, Box, Carrot, Cat, Check, ChevronLeft, Circle, CircleDashed, CircleDot,
  Cloud, CloudOff, Cone, Copy, Crosshair, Crown, Cuboid, Cylinder, Database, Dices, Disc3, Dog, Download, Drama, Ear, Eye, Feather,
  Fish, Flame, Footprints, Frown, Ghost, Glasses, Globe, Grid3x3, GripVertical, Hand, HardHat, Headphones, Heart, IceCreamCone, Inbox, Info,
  Laugh, Lock, LockOpen, Minus, Mouse, Package, PartyPopper, PawPrint, Pencil, PersonStanding, Pointer, Printer, QrCode, Rabbit,
  RadioTower, Radiation, RefreshCw, Rocket, RotateCcw, Satellite, School, Send, Shell, Shield, Shirt, Skull, Smile, Snail, Sparkles,
  Spline, Square, Squirrel, Star, Sword, Target, Trash2, TriangleAlert, Trophy, Turtle, Tv, UserRound, Wand, WandSparkles, Waves,
  Wrench, X, Zap,
  type IconNode,
} from 'lucide';

const ICONS = {
  Antenna, Archive, Ban, Bird, Bone, Bot, Box, Carrot, Cat, Check, ChevronLeft, Circle, CircleDashed, CircleDot, Cloud, CloudOff,
  Cone, Copy, Crosshair, Crown, Cuboid, Cylinder, Database, Dices, Disc3, Dog, Download, Drama, Ear, Eye, Feather, Fish, Flame,
  Footprints, Frown, Ghost, Glasses, Globe, Grid3x3, GripVertical, Hand, HardHat, Headphones, Heart, IceCreamCone, Inbox, Info, Laugh,
  Lock, LockOpen, Minus, Mouse, Package, PartyPopper, PawPrint, Pencil, PersonStanding, Pointer, Printer, QrCode, Rabbit,
  RadioTower, Radiation, RefreshCw, Rocket, RotateCcw, Satellite, School, Send, Shell, Shield, Shirt, Skull, Smile, Snail, Sparkles,
  Spline, Square, Squirrel, Star, Sword, Target, Trash2, TriangleAlert, Trophy, Turtle, Tv, UserRound, Wand, WandSparkles, Waves,
  Wrench, X, Zap,
} satisfies Record<string, IconNode>;

export type IconName = keyof typeof ICONS;

export function icon(name: IconName, cls = 'w-5 h-5'): SVGElement {
  const el = createElement(ICONS[name]) as SVGElement;
  el.setAttribute('class', cls);
  el.setAttribute('aria-hidden', 'true');
  return el;
}

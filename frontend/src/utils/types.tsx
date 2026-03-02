export type Stroke = {
  coordinates: number[][];
  color: string;
  strokeWidth: number;
};

export type Canvas = {
  strokes: Stroke[];
  currentColor: string;
  currentWidth: number;
};

export enum MouseEventType {
  PRESSED,
  DRAWING,
  RELEASED,
}

export type Message = {
  senderName: string;
  content: string;
};

export type Player = {
  name: string;
  id: number;
  points: number;
};

export type Notification = {
  heading: string;
  content: string;
};

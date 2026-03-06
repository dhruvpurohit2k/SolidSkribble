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
  isGuess: boolean;
};

export type Player = {
  name: string;
  id: number;
  points: number;
  inActive: boolean;
};

export type Notification = {
  heading: string;
  content: string;
};

export type Score = {
  playerName: string;
  pointsAdded: number;
};

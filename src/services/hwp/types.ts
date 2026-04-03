export interface HwpSection {
  paragraphs: HwpParagraph[];
}

export interface HwpParagraph {
  text: string;
  style?: ParagraphStyle;
  charShapes?: CharShape[];
}

export interface ParagraphStyle {
  alignment?: 'left' | 'center' | 'right' | 'justify';
  heading?: number; // 0 = normal, 1-6 = heading levels
}

export interface CharShape {
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
}

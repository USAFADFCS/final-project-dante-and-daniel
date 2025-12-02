export interface WorkoutSet {
  set_number: number;
  reps: number;
  weight: string | null;
  reps_in_reserve: number | null;
  notes: string | null;
}

export interface Exercise {
  name: string;
  sets: WorkoutSet[];
}

export interface WorkoutLog {
  exercises: Exercise[];
  workout_type: 'strength' | 'cardio' | 'mixed' | 'other';
  duration: string | null;
  date: string | null; // ISO string preferred
  notes: string | null;
  id?: string; // Internal ID for React keys
  timestamp?: number; // Internal timestamp for sorting
}

export enum MessageSender {
  USER = 'USER',
  AI = 'AI',
  SYSTEM = 'SYSTEM'
}

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  content: string;
  type?: 'text' | 'log_success';
  relatedLogId?: string;
  timestamp: number;
}

export enum AgentType {
  FRONT_DESK = 'FRONT_DESK',
  LOGGER = 'LOGGER',
  COACH = 'COACH'
}

export type PersonaId = 'standard' | 'arnold' | 'zen';

export interface CoachPersona {
  id: PersonaId;
  name: string;
  description: string;
  geminiVoice: string; // 'Puck' | 'Charon' | 'Kore' | 'Sadachbia' | 'Zephyr'
  systemPromptModifier: string;
}

export const PERSONAS: Record<PersonaId, CoachPersona> = {
  standard: {
    id: 'standard',
    name: 'Coach Pro',
    description: 'Professional & Encouraging',
    geminiVoice: 'Kore',
    systemPromptModifier: 'You are an expert Fitness Coach. Be encouraging, technically accurate, and concise.'
  },
  arnold: {
    id: 'arnold',
    name: 'Ronnie',
    description: 'Motivating & Intense',
    geminiVoice: 'Sadachbia',
    systemPromptModifier: 'Act as legendary bodybuilder Ronnie Coleman, coaching the user with 11/10 energy, a Southern drawl, and catchphrases like "YEAH BUDDY!" and "LIGHT WEIGHT BABY!", focusing on intense motivation and heavy lifting.'
  },
  zen: {
    id: 'zen',
    name: 'Zen Master',
    description: 'Calm & Mindful',
    geminiVoice: 'Zephyr',
    systemPromptModifier: 'You are a mindful yoga and fitness master. Speak in a calm, slightly cryptic, wise manner. Focus on breath, balance, and inner peace. Use metaphors from nature.'
  }
};
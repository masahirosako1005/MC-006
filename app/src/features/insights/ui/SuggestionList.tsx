// INS-UI-09。スタブ。
import type { BusinessCategory, SuggestionCard } from "../types";

export interface SuggestionListProps { cards: SuggestionCard[]; ownCategory: BusinessCategory; minCount: number }
export function SuggestionList(props: SuggestionListProps) { void props; return <div />; }

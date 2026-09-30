// Input actions (Phase 2's InputManager consumes these; no key codes are
// hardcoded anywhere else).

export enum InputAction {
  MoveUp = 'moveUp',
  MoveDown = 'moveDown',
  MoveLeft = 'moveLeft',
  MoveRight = 'moveRight',
  RollLeft = 'rollLeft',
  RollRight = 'rollRight',
  Fire = 'fire',
  Boost = 'boost',
  Brake = 'brake',
  CycleCamera = 'cycleCamera',
  Pause = 'pause',
}

export const ACTION_ORDER: readonly InputAction[] = [
  InputAction.MoveUp,
  InputAction.MoveDown,
  InputAction.MoveLeft,
  InputAction.MoveRight,
  InputAction.RollLeft,
  InputAction.RollRight,
  InputAction.Fire,
  InputAction.Boost,
  InputAction.Brake,
  InputAction.CycleCamera,
  InputAction.Pause,
];

export const ACTION_LABEL: Record<InputAction, string> = {
  [InputAction.MoveUp]: 'Move up',
  [InputAction.MoveDown]: 'Move down',
  [InputAction.MoveLeft]: 'Move left',
  [InputAction.MoveRight]: 'Move right',
  [InputAction.RollLeft]: 'Roll left',
  [InputAction.RollRight]: 'Roll right',
  [InputAction.Fire]: 'Fire',
  [InputAction.Boost]: 'Boost',
  [InputAction.Brake]: 'Brake',
  [InputAction.CycleCamera]: 'Cycle camera',
  [InputAction.Pause]: 'Pause',
};

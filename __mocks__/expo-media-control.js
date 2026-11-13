// Jest 用の代役: 本物のモジュールは import 時にネイティブの TurboModule を要求する。
const calls = {
  enable: jest.fn(() => Promise.resolve()),
  disable: jest.fn(() => Promise.resolve()),
  metadata: jest.fn(() => Promise.resolve()),
  playbackState: jest.fn(() => Promise.resolve()),
};

export const MediaControl = {
  enableMediaControls: calls.enable,
  disableMediaControls: calls.disable,
  resetControls: jest.fn(() => Promise.resolve()),
  updateMetadata: calls.metadata,
  updatePlaybackState: calls.playbackState,
  addListener: jest.fn(() => () => {}),
  removeAllListeners: jest.fn(() => Promise.resolve()),
};

export const Command = {
  PLAY: "play",
  PAUSE: "pause",
  STOP: "stop",
  NEXT_TRACK: "nextTrack",
  PREVIOUS_TRACK: "previousTrack",
};

export const PlaybackState = {
  NONE: 0,
  STOPPED: 1,
  PLAYING: 2,
  PAUSED: 3,
};

export default { calls };

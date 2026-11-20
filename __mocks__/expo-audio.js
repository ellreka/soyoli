const player = {
  volume: 1,
  play: jest.fn(),
  seekTo: jest.fn(() => Promise.resolve()),
  listeners: new Set(),
  addListener: jest.fn((_event, listener) => {
    player.listeners.add(listener);
    return {
      remove: () => {
        player.listeners.delete(listener);
      },
    };
  }),
  emit: (status) => {
    for (const listener of Array.from(player.listeners)) {
      listener(status);
    }
  },
};

module.exports = {
  player,
  createAudioPlayer: jest.fn(() => player),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
};

// テストでのページめくり音: 頼まれたことを記録するだけのプレーヤー。
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
  /** 音が鳴っている間にプラットフォームがするように、再生状態を知らせる。 */
  emit: (status) => {
    // コピーを回す: リスナーは呼ばれている最中に自分を外すことがある。
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

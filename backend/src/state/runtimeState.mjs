const state = {
  fatal: false,
  fatalReason: "",
  startedAt: Date.now(),
};

export const markFatal = (reason = "fatal") => {
  state.fatal = true;
  state.fatalReason = reason;
};

export const clearFatal = () => {
  state.fatal = false;
  state.fatalReason = "";
};

export const getRuntimeState = () => ({
  ...state,
  uptimeSeconds: Math.floor((Date.now() - state.startedAt) / 1000),
});


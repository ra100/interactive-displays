// Its own module so tests can replace it; jsdom cannot reload.
export const reloadPage = (): void => {
  window.location.reload();
};

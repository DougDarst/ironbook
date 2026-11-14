/**
 * Shared layout state. On iPhone, a screen with its own bottom action bar
 * ("Start workout", "Finish workout") hides the tab bar while it's shown.
 */
class Layout {
  hideTabBar = $state(false);
}

export const layout = new Layout();

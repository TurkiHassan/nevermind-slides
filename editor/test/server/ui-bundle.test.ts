import { describe, expect, it } from 'vitest';
import { composeShell } from '../../src/server/ui-bundle.ts';

describe('editor shell composition', () => {
  it('inlines CSS and JS without allowing their own closing tags to terminate the host tags', () => {
    const shell = composeShell(
      '<style>/*NM_UI_CSS*/</style><div id="app"></div><script>/*NM_UI_JS*/</script>',
      { css: 'body::after{content:"</style>"}', js: 'window.x="</script>"' },
    );
    expect(shell).toContain('body::after{content:"<\\/style>"}');
    expect(shell).toContain('window.x="<\\/script>"');
    expect(shell).not.toContain('/*NM_UI_CSS*/');
    expect(shell).not.toContain('/*NM_UI_JS*/');
  });
});

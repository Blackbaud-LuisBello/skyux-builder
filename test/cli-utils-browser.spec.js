/*jshint jasmine: true, node: true */
'use strict';

const logger = require('winston');
const mock = require('mock-require');
const merge = require('merge');
const url = require('url');

const hostUtils = require('../utils/host-utils');
const runtimeUtils = require('../utils/runtime-test-utils');

describe('browser utils', () => {

  let openCalled;
  let openParamUrl;
  let openParamBrowser;

  beforeEach(() => {
    openCalled = false;
    openParamUrl = '';
    openParamBrowser = undefined;

    mock('open', (url, browser) => {
      openCalled = true;
      openParamUrl = url;
      openParamBrowser = browser;
    });

    spyOn(logger, 'info');
  });

  afterEach(() => {
    mock.stopAll();
  });

  function bind(settings) {
    const merged = merge.recursive({
      argv: {},
      skyPagesConfig: runtimeUtils.getDefault(),
      stats: {
        toJson: () => ({
          chunks: []
        })
      },
      port: ''
    }, settings);

    mock.reRequire('../cli/utils/browser')(
      merged.argv,
      merged.skyPagesConfig,
      merged.stats,
      merged.port
    );

    return merged;
  }

  function testLaunchHost(argv) {
    const port = 1234;
    const appBase = 'app-base';

    const settings = bind({
      argv: argv,
      port: port,
      skyPagesConfig: {
        runtime: runtimeUtils.getDefaultRuntime,
        skyux: runtimeUtils.getDefaultSkyux({
          name: appBase
        })
      }
    });

    const localUrl = `https://localhost:${port}/${appBase}/`;
    const hostUrl = hostUtils.resolve(
      '',
      localUrl,
      [],
      settings.skyPagesConfig
    );

    expect(logger.info).toHaveBeenCalledWith(`Launching Host URL: ${hostUrl}`);
    expect(openCalled).toBe(true);
    expect(openParamUrl).toBe(hostUrl);
  }

  it('should run envid and svcid through encodeURIComponent', () => {
    const s = bind({
      argv: {
        launch: 'host',
        envid: '&=$',
        svcid: '^%'
      }
    });

    expect(openParamUrl).toContain(
      `?envid=${encodeURIComponent(s.argv.envid)}&svcid=${encodeURIComponent(s.argv.svcid)}`
    );
  });

  it('should pass through envid and svcid, but not other flags from the command line', () => {
    const settings = bind({
      argv: {
        launch: 'host',
        envid: 'my-envid',
        svcid: 'my-svcid',
        noid: 'nope'
      }
    });

    const parsed = url.parse(openParamUrl, true);
    expect(parsed.query.envid).toBe(settings.argv.envid);
    expect(parsed.query.svcid).toBe(settings.argv.svcid);
    expect(parsed.query.noid).not.toBeDefined();
  });

  it('should default --launch to host', () => {
    testLaunchHost({});
  });

  it('should log the host url and launch it when --launch host', () => {
    testLaunchHost({ launch: 'host' });
  });

  it('should log the local url and launch it when --launch local', () => {

    const port = 1234;
    const appBase = 'app-base';
    const url = `https://localhost:${port}/${appBase}/`;

    bind({
      argv: {
        launch: 'local'
      },
      port: port,
      skyPagesConfig: {
        runtime: runtimeUtils.getDefaultRuntime,
        skyux: runtimeUtils.getDefaultSkyux({
          name: appBase
        })
      }
    });

    expect(logger.info).toHaveBeenCalledWith(`Launching Local URL: ${url}`);
    expect(openCalled).toBe(true);
    expect(openParamUrl).toBe(url);
  });

  it('should log a done message and not launch it when --launch none', () => {
    bind({
      argv: {
        launch: 'none'
      }
    });
    expect(logger.info).not.toHaveBeenCalled();
    expect(openCalled).toBe(false);
  });

  it('should pass --browser flag to open', () => {
    const settings = {
      argv: {
        browser: 'custom-browser',
        launch: 'host'
      }
    };

    bind(settings);
    expect(openCalled).toBe(true);
    expect(openParamBrowser).toEqual(settings.argv.browser);
  });

  it('should handle --browser edge different syntax', () => {
    bind({
      argv: {
        browser: 'edge',
        launch: 'host'
      }
    });
    expect(openParamBrowser).not.toBeDefined();
    expect(openParamUrl.indexOf('microsoft-edge')).toBe(0);
  });

});

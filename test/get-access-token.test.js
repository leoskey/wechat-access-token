const mocha = require('mocha');
const assert = require('power-assert');
const { WechatAccessToken, WechatAccessTokenError } = require('../lib/wechat-access-token');

const appConfig = {
  appID: 'wx0b35433342ed6d59',
  appSecret: '4f37ade72ee18fbc927cac0dc670ca2b'
};

describe('wechat-access-token', () => {
  before(async() => {
    const client = new WechatAccessToken('redis://:@127.0.0.1:6379');
    this.client = client;

  });

  after(async() => {
    this.client.redis.quit();

  });

  beforeEach(async() => {
    await this.client.redis.del(`wechat_access_token/${appConfig.appID}`);

  });

  it('should reuturn latest access token', async() => {
    const accessTokenResult = await this.client.getAccessToken(appConfig);
    assert.ok(typeof accessTokenResult.accessToken === 'string');

  });

  it('should reuturn cache access token', async() => {
    const accessTokenFirstResult = this.client.getAccessToken(appConfig);
    const accessTokenSecondResult = this.client.getAccessToken(appConfig);
    const accessTokenThirdResult = this.client.getAccessToken(appConfig);
    const values = await Promise.all([accessTokenFirstResult, accessTokenSecondResult, accessTokenThirdResult]);
    assert.equal(values[0].accessToken, values[1].accessToken);
    assert.equal(values[0].accessToken, values[2].accessToken);

  });

  it('should return wechat config error', async() => {
    await (async() => {
      try {
        await this.client.getAccessToken(null);
      } catch (error) {
        assert.throws(error, /WechatAccessTokenError/);
      }
    });

  });

  it('should return wechat api error', async() => {
    await (async() => {
      try {
        await this.client.getAccessToken({ appID: 'wx', appSecret: 'wx' });
      } catch (error) {
        console.log('执行')
        console.log(error)
        assert.throws(error, /WechatAccessTokenError/);
      }
    });

  });

});
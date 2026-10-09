import pkg from '../../package.json'

/** 前端（应用自身）版本号，取自 package.json 的 version 字段 */
export const APP_VERSION = (pkg as { version: string }).version

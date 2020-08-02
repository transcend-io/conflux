import mod from './mod.js';
import fixtures from './fixtures.json';

const { reviver } = mod();
export default JSON.parse(JSON.stringify(fixtures), reviver);

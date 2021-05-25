import {promises as fs} from 'fs';
import {default as jsyaml} from 'js-yaml';
import Sequelize from "sequelize";
import DBG from 'debug';
const debug = DBG('notes:notes-sequelize');

let sequlz;

export async function connectDB() {
    if (typeof sequlz === 'undefined') {
        //这里因为配置数据太多，没有办法通过环境变量去配置，所以可以通过 yaml 文件将所需的所有的变量转换为
        // params object。所有的变量都在 yaml 文件中配置，注意 yaml 文件中的名称，可以在 yaml 中写 comment
        // 指明配置名称，比如 dbname, username, password...
        // 这里的一系列的判断是防止有环境变量的配置，如果有，就覆盖掉 yaml 文件的数据。
        const yamltext = await fs.readFile(process.env.SEQUELIZE_CONNECT, 'utf-8');
        const params = jsyaml.safeLoad(yamltext, 'utf-8'); //返回一个 object.
        debug('yaml loadded...');
        // console.log(params);

        if (typeof process.env.SEQUELIZE_DBNAME !== 'undefined' && process.env.SEQUELIZE_DBNAME !== '') {
            params.dbname = process.env.SEQUELIZE_DBNAME;
        }

        if (typeof process.env.SEQUELIZE_DBUSER !== 'undefined' && process.env.SEQUELIZE_DBUSER !== '') {
            params.username = process.env.SEQUELIZE_DBUSER;
        }

        if (typeof process.env.SEQUELIZE_DBPASSWD !== 'undefined' && process.env.SEQUELIZE_DBPASSWD !== '') {
            params.password = process.env.SEQUELIZE_DBPASSWD;
        }

        if (typeof process.env.SEQUELIZE_DBHOST !== 'undefined' && process.env.SEQUELIZE_DBHOST !== '') {
            params.host = process.env.SEQUELIZE_DBHOST;
        }

        if (typeof process.env.SEQUELIZE_DBPORT !== 'undefined' && process.env.SEQUELIZE_DBPORT !== '') {
            params.port = process.env.SEQUELIZE_DBPORT;
        }

        if (typeof process.env.SEQUELIZE_DBDIALECT !== 'undefined' && process.env.SEQUELIZE_DBDIALECT !== '') {
            params.dialect = process.env.SEQUELIZE_DBDIALECT;
        }

        //public constructor(database: string, username: string, password: string, options: object)
        sequlz = new Sequelize(
            params.dbname, params.username, params.password.toString(),
            //todo 这个 bug 搞了我半天啊，password 是一个 string，
            //todo 但是 yaml 的 safeload 将都是数字的密码转换成了 number 类型。在 Sequelize() 中，port 是 number 类型的，password 是 string 类型。
            {host: params.host, port: params.port, dialect: params.dialect}
        );
        //You can use the .authenticate() function to test if the connection is OK
        await sequlz.authenticate();
        debug('connected...');
    }
    return sequlz;
}

export async function close() {
    if (sequlz) sequlz.close();
    sequlz = undefined; //我们不仅需要关闭 sequlz，还需要手动将其设为 undefined，因为再次启动需要检测。
}
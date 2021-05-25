import {Command} from 'commander/esm.mjs';
const program = new Command();
program.version('0.0.1');
import {default as restify} from 'restify-clients';
import * as util from 'util';
import DBG from 'debug';
const log = DBG('users:cli');
const error = DBG('users:error');
import {default as bcrypt} from 'bcrypt';
const saltRounds = 10;

let client_port;
let client_host;
let client_version = '*';
let client_protocal;
let authid = 'them';
let authcode = 'D4ED43C0-8BD6-4FE2-B358-7C0E230D11EF';

const client = (program) => {
    /**
     * todo 注意这里，这里和示例代码不容，示例代码是错误的，新版本的 Commander 提供了 program.opts() 方法将 program 的 options 放到对象中返回。
     * @type {commander.OptionValues}
     */
    const options = program.opts();
    console.log(options);
    if (typeof process.env.PORT === 'string')
            client_port = Number.parseInt(process.env.PORT);
    if (typeof options.port === 'string')
            client_port = Number.parseInt(options.port);
    if (typeof options.host ===  'string') client_host = options.host;
    console.log(client_host);//这里为什么是 undefined??

    if (typeof options.url === 'string') {
        let purl = new URL(program.url);
        if (purl.host && purl.host !== '') client_host = purl.host;
        if (purl.port && purl.port !== '') client_port = purl.port;
        if (purl.protocol && purl.protocol !== '') client_protocal = purl.protocol;
    }
    //默认连接，如果没有提供，就使用默认。如果在 command line 中提供了，那么就会通过解析 url 对 connect_url 进行赋值。
    //结果就是，我们可以使用任何连接，无论是本地电脑还是远程服务器，都可以获得 user 服务。
    /**
     *  let connect_url = new URL('http://localhost:5858');
     *  当把 userserver 放到服务器的时候，使用 cli 向服务器闯将用户一直提示连接错误，然后发现是这里的代码错误。
     *  发现无论是否提供 host，这里的最终发送请求的地址一直是 localhost。
     */
    let connect_url = new URL('http://localhost:5858');
    if (client_protocal) connect_url.protocol = client_protocal;
    if (client_host) connect_url.hostname = client_host;
    if (client_port) connect_url.port = client_port;
    let client = restify.createJsonClient({
        url: connect_url.href,
        version: client_version
    });
    client.basicAuth(authid, authcode);
    console.log('client complete..', `host: ${connect_url.host}`);
    return client;
}

//下面就是为 program 提供一些 flag，会根据这些 flag 对变量进行赋值，<> 中的内容很重要，不是胡乱写的，这是
//后面需要 program.port 等等的变量名。
program.description('cli for userserver')
    .option('-p, --port <port>', 'Port number for user server, if using localhost')
.option('-h, --host <host>', 'Port number for user server, if using localhost')
.option('-u, --url <url>', 'Connection URL for user service, if using a remote server');

//implement the sub-commands
program
    //注意这里的 username 会放到 .action 中作为变量使用。
    .command('add <username>') //usbcommand, add takes one parameter username.
    .description('Add a user to the user server')
    //注意这里的 option 都是 subcommand 的选项
    .option('--password <password>', 'Password for new user')
    .option('--family-name <familyName>', 'Family name, or last name, of the user')
    .option('--given-name <givenName>','Given name, or first name, of the user')
    .option('--middle-name <middleName>', 'Middle name of the user')
    .option('--email <email>', 'Email address for the user')
    //.action 里面是回调函数，在 command 看到 subcommand 的时候会调用。
    //所有在 .command 中的参数都会用于回调函数中，而所有 subcommand option 中的参数都会放到 cmdObj 中用回调函数。
    //注意这里与 global command 的不同，global command 中的 option 参数都是附带在 program 中的。
    .action(async (username, cmdObj) => {
        //注意这里的
        const topost = {
            username: username,
            password: await hashpass(cmdObj.password),
            provider: "local",
            familyName: cmdObj.familyName,
            givenName: cmdObj.givenName,
            middleName: cmdObj.middleName,
            emails: [], photos: []
        };
        if (typeof cmdObj.email !== 'undefined') topost.emails.push(cmdObj.email);
        console.log(`tocreate ${util.inspect(topost)}`);

        //JSONClient.post(link, object, callback(err, req, res, obj))
        //注意这个回调函数，里面的 obj 是返回的对象，这个参看 router.
        client(program).post({path: '/create-user'}, topost, (err, req, res, obj) => {
            console.log(util.inspect(req.path));
            if (err) console.error(err, err.stack);
            else console.log('created ' + util.inspect(obj))
        });
    });

program.command('find-or-create <username>')
    .description('Add a user to the user server')
    .option('--password <password>', 'Password for new user')
    .option('--family-name <familyName>', 'Family name, or last name, of the user')
    .option('--given-name <givenName>','Given name, or first name, of the user')
    .option('--middle-name <middleName>', 'Middle name of the user')
    .option('--email <email>', 'Email address for the user')
    .action(async (username, cmdObj) => {
        const topost= {
            username,
            password: await hashpass(cmdObj.password),
            provider: 'local',
            familyName: cmdObj.familyName,
            givenName: cmdObj.givenName,
            middleName: cmdObj.middleName,
            emails: [], photos: []
        };
        if (typeof cmdObj.email !== 'undefined') topost.emails.push(cmdObj.email);

        client(program).post('/find-or-create', topost, (err, req, res, obj) => {
            if (err) console.error(err.stack);
            else console.log(`Found or Created ` + util.inspect(obj));
        });
    });



//a test
//这里能得出结果说明 commmand 没有问题。
program.command('test <test>')
    .option('--test1 <test1>')
    .option('--test2 <test2>')
    .option('--test3 <test3>')
    .description('just a test')
    .action((test, cmdObj) => {
        console.log(test, cmdObj.test1, cmdObj.test2, cmdObj.test3);
    });

program.command('find <username>')
    .description('search for a user on the user server')
    .action((username, cmdObj) => {
        /**todo: server.get or post('path', function(req, res, obj)) without err parameter.node 不知道如何处理 async 回调函数的错误的，因此，async 回调函数的参数中没有 err 参数。但是对于 restify client 来说，因为回调函数不是异步函数，所以有err参数。
         * 这里的一个耽误很长时间的 bug：对于 restify client 来说，callback 有四个参数：err, req, res, obj,但是对于
         * restify server 来说，server.get or post('path', callback) 中的回调函数有三个参数：req, res, next. 多写一个 err 就会导致
         * 一直卡在一个地方，连错误都不报。
         */
        client(program).get(`/find/${username}`, (err, req, res, obj) => {
            console.log('request send...');
            if (err) console.error(err.stack);
            else console.log('found ' + util.inspect(obj));
        });
    });

program.command('list-users')
    .description('list all the users on the user server')
    .action((cmdObj) => {
        client(program).get('/list', (err, req, res, obj) => {
            if (err) console.log(err.stack);
            else console.log(util.inspect(obj));
        });
    });

program.command('update <username>')
    .description('update a user to the user server')
    .option('--password <password>', 'Password for new user')
    .option('--family-name <familyName>', 'Family name, or last name, of the user')
    .option('--given-name <givenName>','Given name, or first name, of the user')
    .option('--middle-name <middleName>', 'Middle name of the user')
    .option('--email <email>', 'Email address for the user')
    .action(async (username, cmdObj) => {
        const toupdate = {
            username,
            password: await hashpass(cmdObj.password),
            provider: 'local',
            familyName: cmdObj.familyName,
            givenName: cmdObj.givenName,
            middleName: cmdObj.middleName,
            emails: [], photos: []
        };
        if (typeof cmdObj.email !== 'undefined') {
            toupdate.emails.push(cmdObj.email);
        }
        client(program).post(`/update-user/${username}`, toupdate, (err, req, res, obj) => {
            if (err) console.error(err);
            else console.log('update ' + util.inspect(obj));
        });
    });

program.command('destroy <username>')
    .description('delete one user form the user server')
    .action((username, cmdObj) => {
        client(program).del(`/destroy/${username}`, (err, req, res, obj) =>{
            if (err) console.error(err.stack);
            else console.log("Deleted - result= " + util.inspect(obj));
        });
    });

program.command('password-check <username> <password>')
    .description('check whether the user password checks out')
    .action((username, password, cmdObj) => {
        const body = {
            username: username,
            password: password
        };
        //还是不熟练， client.post() 方法需要 body 参数携带需要传递的信息对象。
        client(program).post('/password-check', body,(err, req, res, obj) => {
            if (err) console.error(err.stack);
            else console.log(util.inspect(obj));
        });
    });

//take plain text password as parameter, return a encrypted password.
async function hashpass(password) {
    let salt = await bcrypt.genSalt(saltRounds);
    let hashed = await bcrypt.hash(password, salt);
    return hashed;
}

program.parse(process.env.argv);




























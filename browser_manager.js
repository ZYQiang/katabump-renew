/**
 * Browser Manager
 *
 * Playwright Chrome 管理
 *
 * 功能:
 *  - 固定Chrome Profile
 *  - 代理注入
 *  - CDP连接
 *  - Storage保存
 */


const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright-extra");
const StealthPlugin =
    require("puppeteer-extra-plugin-stealth");


chromium.use(
    StealthPlugin()
);



class BrowserManager {


    constructor(proxy){


        this.proxy = proxy;


        this.chromeProcess=null;


        this.browser=null;


        this.context=null;


        this.profileDir =
            path.join(
                process.cwd(),
                "chrome_profile"
            );


        this.storageFile =
            path.join(
                process.cwd(),
                "storage_state.json"
            );


    }




    async start(){


        console.log(
            "[Browser] 启动Chrome"
        );



        if(!fs.existsSync(this.profileDir)){

            fs.mkdirSync(
                this.profileDir,
                {
                    recursive:true
                }
            );

        }



        const args=[

            "--remote-debugging-port=9222",

            `--user-data-dir=${this.profileDir}`,

            "--no-first-run",

            "--no-default-browser-check",

            "--disable-background-networking",

            "--disable-component-update",

            "--disable-features=Translate",

            "--disable-quic",

            "--disable-blink-features=AutomationControlled"

        ];





        /*
         * 代理设置
         */

        if(
            this.proxy
            &&
            this.proxy.server
        ){

            args.push(
                `--proxy-server=${this.proxy.server}`
            );


            console.log(
                "[Browser] Proxy:",
                this.proxy.server
            );

        }




        this.chromeProcess =
            spawn(

                "google-chrome",

                args,

                {
                    detached:true,
                    stdio:"ignore"
                }

            );



        this.chromeProcess.unref();



        await this.wait(
            5000
        );




        this.browser =
            await chromium.connectOverCDP(
                "http://127.0.0.1:9222"
            );



        await this.newContext();



        return this.browser;


    }







    async newContext(){



        /*
         * 关闭旧Context
         */

        if(this.context){

            await this.context.close()
            .catch(()=>{});

        }





        const options={


            viewport:
            {
                width:1280,
                height:900
            },


            locale:
            "en-US",


            timezoneId:
            "Asia/Tokyo",


            permissions:
            [],


            ignoreHTTPSErrors:
            true

        };





        /*
         * 恢复状态
         */

        if(
            fs.existsSync(
                this.storageFile
            )
        ){

            options.storageState =
                this.storageFile;

        }




        this.context =
            await this.browser.newContext(
                options
            );



        return this.context;


    }







    async saveState(){


        if(!this.context)
            return;



        await this.context.storageState(
            {
                path:
                this.storageFile
            }
        );


    }







    async newPage(){


        if(!this.context){

            await this.newContext();

        }



        return await this.context.newPage();


    }







    async closeContext(){


        if(this.context){

            await this.saveState();


            await this.context.close()
            .catch(()=>{});


            this.context=null;

        }


    }







    async restartForProxy(proxy){


        console.log(
            "[Browser] 切换代理，重建浏览器"
        );



        this.proxy=proxy;



        await this.close();

        await this.start();


    }







    async close(){


        if(this.context){

            await this.context.close()
            .catch(()=>{});

        }



        if(this.browser){

            await this.browser.close()
            .catch(()=>{});

        }




        if(this.chromeProcess){

            try{

                process.kill(
                    this.chromeProcess.pid
                );

            }catch(e){}


        }



        this.context=null;

        this.browser=null;

        this.chromeProcess=null;


    }







    async wait(ms){

        return new Promise(
            resolve=>
            setTimeout(resolve,ms)
        );

    }


}




module.exports =
BrowserManager;

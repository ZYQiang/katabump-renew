/**
 * Proxy Manager
 *
 * 支持:
 * 1. HTTP_PROXY
 * 2. SUB_URL + Mihomo
 *
 * 自动选择最佳代理
 */

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { execSync, spawn } = require("child_process");


class ProxyManager {


    constructor(){

        this.httpProxy = process.env.HTTP_PROXY;
        this.subUrl = process.env.SUB_URL;

        this.activeProxy = null;

        this.mihomoPath =
            path.join(process.cwd(),"mihomo");

        this.workDir =
            path.join(process.cwd(),"mihomo_data");


        this.proxyPool=[];

        this.statsFile =
            path.join(
                process.cwd(),
                "proxy_stats.json"
            );
    }



    async init(){

        console.log("\n========== Proxy Manager ==========");


        /*
         * 第一优先:
         * HTTP_PROXY
         */
        if(this.httpProxy){

            console.log(
                "[Proxy] 检测 HTTP_PROXY..."
            );


            if(await this.testHttpProxy()){

                this.activeProxy={
                    type:"HTTP_PROXY",
                    server:this.httpProxy
                };


                console.log(
                    "[Proxy] 使用 HTTP_PROXY"
                );


                return this.activeProxy;
            }


            console.log(
                "[Proxy] HTTP_PROXY失败"
            );

        }



        /*
         * 第二:
         * Mihomo
         */
        if(this.subUrl){

            console.log(
                "[Proxy] 尝试 SUB_URL + Mihomo"
            );


            const ok =
                await this.initMihomo();


            if(ok){

                this.activeProxy={
                    type:"MIHOMO",
                    server:"http://127.0.0.1:7890"
                };


                console.log(
                    "[Proxy] 使用 Mihomo"
                );


                return this.activeProxy;

            }

        }



        console.log(
            "[Proxy] 无可用代理，直连"
        );


        this.activeProxy={
            type:"DIRECT",
            server:null
        };


        return this.activeProxy;

    }





    /*
     * 测试HTTP代理
     */
    async testHttpProxy(){


        try{


            const res =
                await axios.get(
                    "https://dashboard.katabump.com/auth/login",
                    {
                        proxy:false,

                        timeout:10000,

                        headers:{
                            "User-Agent":
                            "Mozilla/5.0"
                        }
                    }
                );


            return res.status < 500;



        }catch(e){


            console.log(
                "[HTTP_PROXY]",
                e.message
            );


            return false;
        }


    }





    /*
     * 初始化 Mihomo
     */
    async initMihomo(){


        try{


            await this.downloadMihomo();


            if(!fs.existsSync(this.workDir)){

                fs.mkdirSync(
                    this.workDir,
                    {
                        recursive:true
                    }
                );
            }



            const config =
`
mixed-port: 7890

allow-lan: false

mode: rule

log-level: info


external-controller:
127.0.0.1:9090


proxy-providers:

  sub1:

    type: http

    url: "${this.subUrl}"

    interval: 3600

    path: ./sub1.yaml



proxy-groups:

 - name: AUTO

   type: select

   use:

    - sub1



rules:

 - MATCH,AUTO

`;



            fs.writeFileSync(
                path.join(
                    this.workDir,
                    "config.yaml"
                ),
                config
            );



            spawn(
                this.mihomoPath,
                [
                    "-d",
                    this.workDir,
                    "-f",
                    "config.yaml"
                ],
                {
                    detached:true,
                    stdio:"ignore"
                }
            ).unref();



            await this.sleep(5000);



            await axios.put(
                "http://127.0.0.1:9090/providers/proxies/sub1"
            ).catch(()=>{});



            await this.sleep(3000);



            const nodes =
                await this.getNodes();



            if(nodes.length===0){

                return false;
            }



            this.proxyPool =
                await this.testNodes(nodes);



            if(this.proxyPool.length===0){

                return false;
            }



            await this.switchNode(
                this.proxyPool[0]
            );


            return true;



        }catch(e){

            console.log(
                "[Mihomo失败]",
                e.message
            );


            return false;

        }


    }






    /*
     * 自动下载对应架构 Mihomo
     */
    async downloadMihomo(){


        if(fs.existsSync(this.mihomoPath))
            return;



        let target=null;


        if(process.platform==="linux"){


            if(process.arch==="x64")
                target="mihomo-linux-amd64";


            if(process.arch==="arm64")
                target="mihomo-linux-arm64";

        }



        if(process.platform==="darwin"){


            if(process.arch==="arm64")
                target="mihomo-darwin-arm64";


            else
                target="mihomo-darwin-amd64";

        }



        if(!target){

            throw new Error(
                "不支持架构:"
                +
                process.platform
                +
                "-"
                +
                process.arch
            );

        }



        const url =
`https://github.com/MetaCubeX/mihomo/releases/latest/download/${target}`;



        console.log(
            "下载:",
            url
        );


        execSync(
            `curl -L "${url}" -o ${this.mihomoPath}`
        );


        execSync(
            `chmod +x ${this.mihomoPath}`
        );

    }





    async getNodes(){


        const res =
            await axios.get(
                "http://127.0.0.1:9090/proxies/AUTO"
            );


        return res.data.all
            .filter(
                x =>
                x!=="DIRECT"
                &&
                x!=="REJECT"
                &&
                x!=="AUTO"
            );


    }






    async testNodes(nodes){


        const good=[];


        for(const node of nodes){


            try{


                const r =
                await axios.get(

`http://127.0.0.1:9090/proxies/${encodeURIComponent(node)}/delay?timeout=3000&url=https://www.gstatic.com/generate_204`

                );


                if(r.data.delay){

                    good.push({
                        name:node,
                        delay:r.data.delay
                    });

                }


            }catch(e){}


        }



        good.sort(
            (a,b)=>
            a.delay-b.delay
        );



        return good.map(
            x=>x.name
        );

    }





    async switchNode(name){


        await axios.put(

            "http://127.0.0.1:9090/proxies/AUTO",

            {
                name:name
            }

        );


        console.log(
            "[Mihomo节点]",
            name
        );


    }





    getProxy(){


        return this.activeProxy;

    }





    async sleep(ms){

        return new Promise(
            r=>setTimeout(r,ms)
        );

    }

}



module.exports =
ProxyManager;

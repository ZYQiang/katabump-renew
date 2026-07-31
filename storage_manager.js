/**
 * Storage Manager
 *
 * 负责:
 *
 * 1. 续期记录
 * 2. 代理评分
 * 3. 账号历史
 * 4. 运行状态
 *
 */


const fs = require("fs");
const path = require("path");



class StorageManager {


    constructor(){


        this.dir =
            path.join(
                process.cwd(),
                "storage"
            );



        if(!fs.existsSync(this.dir)){

            fs.mkdirSync(
                this.dir,
                {
                    recursive:true
                }
            );

        }



        this.files={


            renew:
            path.join(
                this.dir,
                "renew_dates.json"
            ),



            proxy:
            path.join(
                this.dir,
                "proxy_stats.json"
            ),



            account:
            path.join(
                this.dir,
                "account_history.json"
            ),



            runtime:
            path.join(
                this.dir,
                "runtime.json"
            )

        };


    }






    init(){


        Object.values(this.files)
        .forEach(file=>{


            if(!fs.existsSync(file)){


                fs.writeFileSync(
                    file,
                    "{}",
                    "utf8"
                );


            }


        });


    }







    read(file){


        try{


            return JSON.parse(
                fs.readFileSync(
                    file,
                    "utf8"
                )
            );


        }catch(e){


            return {};

        }


    }







    write(file,data){


        fs.writeFileSync(

            file,

            JSON.stringify(
                data,
                null,
                2
            ),

            "utf8"

        );


    }







    /*
     * =====================
     * Renew Date
     * =====================
     */



    getRenewDates(){


        return this.read(
            this.files.renew
        );


    }





    saveRenewDate(
        username,
        date
    ){


        const data =
            this.getRenewDates();



        data[username]=date;



        this.write(
            this.files.renew,
            data
        );


    }








    /*
     * =====================
     * Proxy Stats
     * =====================
     */



    getProxyStats(){


        return this.read(
            this.files.proxy
        );

    }





    recordProxyResult(
        proxy,
        success,
        info={}
    ){



        const data =
            this.getProxyStats();




        if(!data[proxy]){


            data[proxy]={

                success:0,

                fail:0,

                avgDelay:0,

                lastError:null,

                history:[]

            };


        }




        if(success){

            data[proxy].success++;

        }else{


            data[proxy].fail++;


        }




        data[proxy]
        .history
        .push({

            time:
            new Date()
            .toISOString(),


            success,


            ...info

        });




        /*
         * 保留最近100条
         */


        if(
            data[proxy]
            .history
            .length>100
        ){

            data[proxy]
            .history =
            data[proxy]
            .history
            .slice(-100);

        }





        this.write(
            this.files.proxy,
            data
        );

    }








    /*
     * 获取代理评分
     */


    getProxyScore(proxy){


        const data =
            this.getProxyStats();



        const item =
            data[proxy];



        if(!item)
            return 50;



        const total =
            item.success
            +
            item.fail;



        if(total===0)
            return 50;



        const rate =
            item.success
            /
            total;



        return Math.round(
            rate*100
        );


    }









    /*
     * =====================
     * Account History
     * =====================
     */



    getAccountHistory(){


        return this.read(
            this.files.account
        );


    }







    recordAccount(
        username,
        result
    ){



        const data =
            this.getAccountHistory();




        if(!data[username]){


            data[username]=[];

        }




        data[username]
        .push({

            time:
            new Date()
            .toISOString(),


            ...result

        });






        /*
         * 每个账号最多100条
         */


        if(
            data[username]
            .length>100
        ){


            data[username] =
            data[username]
            .slice(-100);


        }





        this.write(
            this.files.account,
            data
        );


    }








    /*
     * =====================
     * Runtime
     * =====================
     */



    saveRuntime(data){


        this.write(
            this.files.runtime,
            {

                time:
                new Date()
                .toISOString(),


                ...data

            }
        );


    }






}



module.exports =
StorageManager;

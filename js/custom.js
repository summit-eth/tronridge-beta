'use strict';

(function() {

let vue_config = {
    data() {
        return {
            current_time: new Date().getTime(),
            tron: {	
                tronWeb: false,
                auth: false,
                account: ''
            },
            initialized: 0,
            public: 1
        };
    },
    created() {
        console.log("App initialising..");
        let self = this, tries = 0;
        setTimeout(function tronCheck() {
            // wait for tronweb
            let tw = window.tronWeb;
            if(!tw) {
                if(++tries < 30) {
                    setTimeout(tronCheck, 100);
                    return;
                } else {
                    // no tronweb
                    console.log("Public Mode");
                    self.tron.tronWeb = new TronWeb({fullHost:"https://api.shasta.trongrid.io"});
                    self.public = 1;
                    self.initialized = 1;
                    return;
                }
            }
            
            self.tron.tronWeb = tw;
            tw.on("addressChanged", () => {
                if(self.public == 1 && !!tw.defaultAddress) {
                    // Late authorization, reconfigure!
                    tw = window.tronWeb;
                    self.public = 0;
                    self.tron.tronWeb = window.tronWeb;
                    self.getTronWeb().then(async tw => {
                        self.trsc = await tw.contract().at(self.contract_address);
                        console.log("Late Authorization");
                    });
                }
                self.tron.account = tw.defaultAddress.base58;
                console.log("Address: " + self.tron.account);
            });
            // check authorization
            tries = 0;
            setTimeout(function authCheck() {
                self.tron.auth = tw && tw.ready;
                if(++tries < 30) {
                    if(!self.tron.auth) {
                        console.log("Waiting for authorization...");
                        setTimeout(authCheck, 100);
                    } else {
                        console.log("Authorized");
                        self.tron.account = tw.defaultAddress.base58;
                        self.public = 0;
                        self.initialized = 1;
                    }
                } else {
                    // Unauthorized Mode
                    console.log("Unauthorized Mode");
                    self.tron.tronWeb = new TronWeb({fullHost:"https://api.shasta.trongrid.io"});
                    self.public = 1;
                    self.initialized = 1;
                    return;
                }
            }, 200);
        }, 100);
        setInterval(() => {
            self.current_time = new Date().getTime();
        }, 200);
    },
    methods: {
        getTronWeb() {
            let self = this;
            return new Promise((resolve, reject) => {
                resolve(self.tron.tronWeb);
            });
        }
    }
};

window.App = new Vue({
    mixins: [vue_config],
    el: '#root',
    data: {
        trsc: {},
        contract_address: 'TDYvQ5Cv6Tuo7bP87VEBCDA5oCuNZsCT9T',
        contract: {
            totalInvested: 0,
            totalBonus: 0,
            totalUsers: 0,
            totalNautsBought: 0,
            totalDustsSold: 0,
            balance: 0,
            volume: 0,
            prices: {
                nauts: "...",
                dusts: "...",
                multiplier: 1000000000000
            },
            circulation: 1000000,
            supply: 1000000,
            launch_date: 1614340800
        },
        user: {
            ref: "TRuc7roGYHhudhQfZy7eyirZLVf53xcLTp",
            wallet: 0,
            nauts: 0,
            nauts_expired: 0,
            dusts: 0,
            dusts_sold: 0,
            mine_rate: 0,
            bonus: 0,
            total_bonus: 0,
            total_referrals: 0,
            referrals: [0,0,0,0,0],
            last_withdraw: 0
        },
        userRequests: 0,
        userTimeouts: {},
        contractRequests: 0,
        contractTimeouts: {},
        calc: {
            buyNauts: 100,
            buyNautsMin: 100,
            buyNautsMax: 100e3, // 100k
            sellDusts: 100,
            sellDustsMin: 100,
            sellDustsMax: 800e3 // 800k
        },
        notifications: []
    },
    mounted() {
        let self = this;
        // set refs
        let m = location.search.match(/ref=(T[1-9A-HJ-NP-Za-km-z]{33})/i);
        if(m) {
            self.user.ref = m[1];
            document.cookie = "ref=" + self.user.ref + "; path=/; expires=" + (new Date(new Date().getTime() + 86400 * 365 * 1000)).toUTCString();
        }
        m = document.cookie.match(/ref=(T[1-9A-HJ-NP-Za-km-z]{33})/i);
        if(m) self.user.ref = m[1];
        
        setTimeout(function configure() {
            console.log("Loading..." + self.initialized);
            if(!self.initialized) {
                return setTimeout(configure, 400);
            }
            self.getTronWeb().then(async tw => {
                self.trsc = await tw.contract().at(self.contract_address);
                console.log("Contract connected");
                setInterval(() => {
                    try {
                        self.fetchData();
                    } catch(e) { console.log(e) }
                }, 3000);
                self.fetchData();
            });
        }, 100);
    },
    watch: {
        'tron.account'() {
            //console.log(this.tron.account);
            //this.tron.account = window.tronWeb.defaultAddress.base58;
        }
    },
    methods: {
        notice(msg, color = 'c2e93c', time = 3000) {
            return new Promise((resolve, reject) => {
                let wrap = $('<div style="position:fixed; left:calc(50% - 150px); box-shadow:0 5px 25px rgba(0,0,0,0.2); width:320px; top:40px; background:#' + (color ? color : '653aba') + '; border-radius:10px; color:#fff; padding:20px 20px; font:14px/1.2 Tahoma, sans-serif; cursor:pointer; z-index:999999; text-align:center;">' + msg + '</div>')
                    .on('click', () => { wrap.remove(); resolve(); })
                    .appendTo('body');
                if(time) setTimeout(() => { wrap.remove(); }, time);
            });
        },
        notify(title, content='', timeout=7e3) {
            let self = this;
            if(content == '') {
                content = title;
                title = '';
            }
            self.notifications.push({
                expiresOn: self.current_time + timeout,
                title: title,
                content: content
            });
            // clean notifications
            for(let i=0; i<self.notifications.length; i++) {
                if(self.notifications[i].expiresOn <= self.current_time) {
                    // remove
                    self.notifications.splice(i, 1);
                    i--;
                }
            }
        },
        closeNotif(index) {
            let self = this;
            self.notifications.splice(index, 1);
        },
        copyRef() {
            let s = document.createElement('input');
            s.value = "https://tronridge.com/?ref=" + this.tron.account;
            document.body.appendChild(s);
            if (navigator.userAgent.match(/ipad|ipod|iphone/i)) {
                s.contentEditable = true;
                s.readOnly = false;
                let range = document.createRange();
                range.selectNodeContents(s);
                let sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
                s.setSelectionRange(0, 999999);
            } else {
                s.select();
            }
            try {
                document.execCommand('copy');
                this.notify("Copied to clipboard", s.value);
            } catch(e) {}
            s.remove();
        },
        formatCrypto(val, dec=4) {
            
            return isNaN(val) ? "..." : (Math.round(val * 10**dec)/10**dec).toFixed(dec);
            // return isNaN(val) ? "..." : (Math.round(val * 1e4)/1e4).toFixed(4);
        },
        prettifyAmount(n) {
            var ranges = [
                { divider: 1e18 , suffix: 'E' },
                { divider: 1e15 , suffix: 'P' },
                { divider: 1e12 , suffix: 'T' },
                { divider: 1e9 , suffix: 'B' },
                { divider: 1e6 , suffix: 'M' },
                { divider: 1e3 , suffix: 'K' }
            ];
            for (var i = 0; i < ranges.length; i++) {
                if (n >= ranges[i].divider) {
                    n = Math.floor(n / (ranges[i].divider/100))/100;
                    return n.toString() + ranges[i].suffix;
                }
            }
            return n.toString();
        },
        updateUserData(from, to, i, data) {
            from = parseFloat(from);
            to = parseFloat(to);
            let self = this;
            let t = 2940;
            let x = 60;
            if(i<t/x && self.userRequests > 2 && from < to) {
                let v = i * ((to-from)/(t/x));
                self.user[data] = from + v;
                clearTimeout(this.userTimeouts[data]);
                self.userTimeouts[data] = setTimeout(function() {
                    self.updateUserData(from, to, i+1, data);
                }, x);
            } else {
                self.user[data] = to;
            }
        },
        updateContractData(from, to, i, data) {
            from = parseFloat(from);
            to = parseFloat(to);
            let self = this;
            let t = 1200;
            let x = 60;
            if(i<t/x && self.contractRequests > 2 && from < to) {
                let v = i * ((to-from)/(t/x));
                self.contract[data] = from + v;
                clearTimeout(this.contractTimeouts[data]);
                self.contractTimeouts[data] = setTimeout(function() {
                    self.updateContractData(from, to, i+1, data);
                }, x);
            } else {
                self.contract[data] = to;
            }
        },
        fetchData() {
            try {
                if(!this.public) {
                    this.getUserInfo();
                    this.getContractInfo();
                } else {
                    this.getEvents();
                }
            } catch(e) {
                this.getEvents();
            }
        },
        getEvents() {
            let self = this;
            this.contractRequests++;
            (async () => {
                try {
                    let e = await self.trsc._getEvents();
                    // event 0 will always have latest contract details
                    if(e.length > 0 && e[0].name == "ContractDetails") {
                        // update data
                        let res = e[0].result;
                        self.updateContractData(self.contract.totalInvested, res.totalInvested , 0, "totalInvested");
                        self.updateContractData(self.contract.totalBonus, res.totalRefBonus , 0, "totalBonus");
                        self.updateContractData(self.contract.totalNautsBought, res.totalNautsBought/1e6 , 0, "totalNautsBought");
                        self.updateContractData(self.contract.totalDustsSold, res.totalDustsSold/1e6 , 0, "totalDustsSold");
                        self.updateContractData(self.contract.balance, res.contractBalance/1e6 , 0, "balance");
                        self.updateContractData(self.contract.circulation, res.circulation/1e6 , 0, "circulation");
                        self.updateContractData(self.contract.supply, res.supply/1e6 , 0, "supply");
                        self.contract.totalUsers = res.totalUsers;
                        self.contract.prices.nauts = 1e6/res.buyRate; // trx per naut
                        self.contract.prices.dusts = res.sellRate/100/self.contract.prices.multiplier; // trx per dust
                        self.contract.volume = res.totalVolume/1e6;
                        console.log("Public details updated");
                    }
                } catch(e) { }
            })();
        },
        getContractInfo() {
            let self = this;
            self.contractRequests++;
            self.trsc.getContractInfo().call().then(res => {
                self.updateContractData(self.contract.totalInvested, res._totalInvested , 0, "totalInvested");
                self.updateContractData(self.contract.totalBonus, res._totalBonus , 0, "totalBonus");
                self.updateContractData(self.contract.totalNautsBought, res._totalNautsBought/1e6 , 0, "totalNautsBought");
                self.updateContractData(self.contract.totalDustsSold, res._totalDustsSold/1e6 , 0, "totalDustsSold");
                self.updateContractData(self.contract.balance, res._balance/1e6 , 0, "balance");
                self.updateContractData(self.contract.circulation, res._circulation/1e6 , 0, "circulation");
                self.updateContractData(self.contract.supply, res._supply/1e6 , 0, "supply");
                self.contract.totalUsers = res._totalUsers;
                self.contract.volume = res._volume/1e6;
                self.contract.prices.multiplier = res._multiplier;
                self.contract.prices.nauts = 1e6/res._nautsPrice; // trx per naut
                self.contract.prices.dusts = res._dustsPrice/100/res._multiplier; // trx per dust
                self.contract.launch_date = 0;
            }).catch(e => {
                console.log("E! getContractInfo");
                console.log(e);
            });
        },
        getUserInfo() {
            let self = this;
            self.userRequests++;
            try {
                self.trsc.tronWeb.trx.getBalance(self.tron.account).then(res => {
                    self.user.wallet = self.formatCrypto(res/1e6);
                });
                
                self.trsc.getUserInfo(self.tron.account).call().then(res => {
                    self.updateUserData(self.user.nauts_expired, res.expiredNauts/1e6, 0, "nauts_expired");
                    self.updateUserData(self.user.nauts, res.totalNauts/1e6, 0, "nauts");
                    self.updateUserData(self.user.dusts, res.availableDusts/1e6, 0, "dusts");
                    self.updateUserData(self.user.dusts_sold, res.totalSellDusts/1e6, 0, "dusts_sold");
                    self.updateUserData(self.user.mine_rate, res.mineRate/1e6, 0, "mine_rate");
                    self.updateUserData(self.user.total_referrals, res.totalReferrals, 0, "total_referrals");
                }).catch(e => {
                    console.log("E! getUserInfo [1]");
                    console.log(e);
                });
                
                self.trsc.getUserReferralInfo(self.tron.account).call().then(res => {
                    self.user.bonus = res.bonus/1e6;
                    self.user.total_bonus = res.totalBonus/1e6;
                    res = res.referrals;
                    for(let i=0; i<5; i++) {
                        self.user.referrals[i] = res[i];
                    }
                }).catch(e => {
                    console.log("E! getUserInfo [2]");
                    console.log(e);
                });
                
                
            } catch(e) {
                // no tron account
                self.public = 1;
            }
        },
        getEventData(txid, name, next) {
            let self = this;
            self.tron.tronWeb.getEventByTransactionID(txid).then(res => {
                for(let i=0; i<res.length; i++) {
                    if(res[i].name == name) {
                        next(res[i].result);
                    }
                }
            });
        },
        buyNauts() {
            let self = this;
            let amount = self.calc.buyNauts;
            if(amount >= self.calc.buyNautsMin && amount <= self.calc.buyNautsMax) {
                self.notify("Please confirm transaction");
                self.trsc.buyNauts(self.user.ref).send({
                    callValue: amount * 1e6,
                    shouldPollResponse: true
                }).then(res => {
                    let boughtNauts = res.totalAmount/1e6;
                    self.notify("Bought " + boughtNauts + " nauts for " + amount + " TRX", '', 6e5);
                }).catch(e => {
                    console.log("E! buyNauts error");
                    try {
                        let txid = e.transaction.txID;
                        self.getEventData(txid, "BuyNauts", res => {
                            let boughtNauts = res.amount/1e6;
                            self.notify("Bought " + boughtNauts + " nauts for " + amount + " TRX", '', 6e5);
                        });
                    } catch(e) {
                        // rejected
                        console.log(e);
                        self.notify("Transaction Cancelled!");
                    }
                });
            } else {
                console.log("E! buyNauts amount out of range");
                self.notify("Amount is out of range!");
            }
        },
        sellDusts() {
            let self = this;
            let amount = self.calc.sellDusts;
            if(amount <= self.user.dusts && amount <= self.calc.sellDustsMax) {
                self.notify("Please confirm transaction");
                self.trsc.sellDusts(amount * 1e6).send({
                    shouldPollResponse: true
                }).then(res => {
                    let totalAmount = res.totalAmount/1e6;
                    self.notify("Sold " + amount + " dusts for " + totalAmount/1e6 + " TRX", '', 6e5);
                }).catch(e => {
                    console.log("E! sellDusts error");
                    try {
                        let txid = e.transaction.txID;
                        self.getEventData(txid, "SellDusts", res => {
                            let totalAmount = res.rate/1e6;
                            self.notify("Sold " + amount + " dusts for " + totalAmount/1e6 + " TRX", '', 6e5);
                        });
                    } catch(e) {
                        // rejected
                        console.log("Transaction Cancelled!");
                    }
                });
            } else {
                console.log("E! sellDusts amount out of range");
                self.notify("Amount is out of range!");
            }
        },
        sellAllDusts() {
            let self = this;
            let amount = self.user.dusts;
            if(amount <= self.calc.sellDustsMax) {
                self.notify("Please confirm transaction");
                self.trsc.sellDustsMax().send({
                    shouldPollResponse: true
                }).then(res => {
                    self.notify("Sold ALL dusts for " + res.totalAmount/1e6 + " TRX", '', 6e5);
                    console.log(res.totalAmount);
                }).catch(e => {
                    console.log("E! sellAllDusts error");
                    try {
                        let txid = e.transaction.txID;
                        self.getEventData(txid, "SellDusts", res => {
                            let totalAmount = res.rate/1e6;
                            self.notify("Sold ALL dusts for " + totalAmount/1e6 + " TRX", '', 6e5);
                        });
                    } catch(e) {
                        // rejected
                        self.notify("Transaction Cancelled!");
                    }
                });
            } else {
                console.log("E! sellDusts amount out of range");
                self.notify("Amount of dusts is too much", "Please sell dusts less than " + self.calc.sellDustsMax/1e6);
            }
        },
        claimBonus() {
            let self = this;
            if(self.user.bonus <= 0) {
                self.notify("No bonus available!");
                return;
            }
            self.notify("Claim Ref Bonus", "Please confirm transaction");
            self.trsc.claimReferral().send({
                shouldPollResponse: true
            }).then(res => {
                self.notify("Claimed " + res.totalAmount/1e6 + " TRX Ref Bonus", '', 6e5);
                console.log(res.totalAmount);
            }).catch(e => {
                console.log("E! claimBonus error");
                try {
                    let txid = e.transaction.txID;
                    self.getEventData(txid, "RefClaim", res => {
                        self.notify("Claimed " + res.totalAmount/1e6 + " TRX Ref Bonus", '', 6e5);
                    });
                } catch(e) {
                    // rejected
                    self.notify("Transaction Cancelled!");
                }
            });
        }
    }
});

})();
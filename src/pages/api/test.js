const url = "http://10.22.26.36/ocr/text2";
const url_dashboard = "http://10.22.26.77:3030/api/addjsondata";
const floorFile = "D:\\dev_cke\\drx\\images\\floor-price.png";
const orderstatusFile = "D:\\dev_cke\\drx\\images\\order-status.png";
const invalid = "invalid";
const noacc = [];
let symbol_tmp = "";
const today = new Date();

const resultdata = { pass: 0, fail: 0, error: 0 };
const resultdetailfail = [];
const stockprice = { stock: "", price: "" };

function key_order(
  no,
  testcase,
  side,
  stock,
  price,
  volume,
  account,
  publish,
  condition,
  date,
  nvdr,
  ot
) {
  Log.Message("---------  order " + no + " Start!!!  ---------");
  Log.Message("Testcase Name => " + testcase);
  if (expect !== "Reject") {
    const existingAccount = noacc.find((item) => item.account === account);
    if (existingAccount) {
      existingAccount.no++;
    } else {
      noacc.push({ account, no: 1 });
    }
  }
  const numberdata = noacc.length;
  for (let i = 0; i < noacc.length; i++) {
    Log.Message("data" + noacc[i].account + "/" + noacc[i].no);
  }
  Log.Message("Start key order !!");
  var onscreenObj = Sys.Desktop.ActiveWindow();
  if (side === "b") {
    Delay(1000);
    onscreenObj.Keys("^b");
  } else {
    Delay(1000);
    onscreenObj.Keys("^s");
  }
  Delay(500);
  onscreenObj.Keys("[Left]");
  Delay(500);
  // key stock
  onscreenObj.Keys(stock);
  onscreenObj.Keys("[Enter]");
  // key volume
  onscreenObj.Keys(volume);
  onscreenObj.Keys("[Enter]");
  if (price) {
    switch (price) {
      case "MKT":
        onscreenObj.Keys("k");
        break;
      case "ATO":
        onscreenObj.Keys("a");
        break;
      case "ATC":
        onscreenObj.Keys("c");
        break;
      case "MLT":
        onscreenObj.Keys("l");
        break;
      default:
        onscreenObj.Keys(price);
    }
    onscreenObj.Keys("[Enter]");
  } else {
    const result = getFloor(side);
    if (equal(result, invalid)) {
      Log.Error("Process Error, Please check server");
    } else if (equal(result, "")) {
      Log.Error("Process Success, Don't have floor");
    } else {
      Log.Message("Process Success");
      Log.Message("Floor Price : " + result);
      if (side === "b") {
        onscreenObj.Keys(StrToFloat(result));
        onscreenObj.Keys("[Enter]");
      } else {
        onscreenObj.Keys(StrToFloat(result));
        onscreenObj.Keys("[Enter]");
        onscreenObj.Keys("y");
        onscreenObj.Keys("[Enter]");
      }
    }
  }
  // key account
  onscreenObj.Keys(account);
  onscreenObj.Keys("[Enter]");
  // key condition
  if (publish || condition || date || nvdr || ot) {
    onscreenObj.Keys("[Left]");
    onscreenObj.Keys("[Left]");
    onscreenObj.Keys("[Left]");
    onscreenObj.Keys("[Left]");
    if (publish) {
      onscreenObj.Keys(publish);
      onscreenObj.Keys("[Enter]");
    } else {
      onscreenObj.Keys("[Enter]");
    }
    if (condition) {
      if (condition === "IOC") {
        onscreenObj.Keys("i");
        onscreenObj.Keys("[Enter]");
      }
      if (condition === "FOK") {
        onscreenObj.Keys("f");
        onscreenObj.Keys("[Enter]");
      }
      if (condition === "GTC") {
        onscreenObj.Keys("c");
        onscreenObj.Keys("[Enter]");
      }
      if (condition === "GTD") {
        onscreenObj.Keys("d");
        onscreenObj.Keys("[Enter]");
      }
    } else {
      onscreenObj.Keys("[Enter]");
    }
    if (date) {
      Delay(500);
      onscreenObj.Keys(date);
      onscreenObj.Keys("[Enter]");
      onscreenObj.Keys("[Enter]");
    } else {
    }
    if (nvdr) {
      Delay(500);
      onscreenObj.Keys(nvdr);
      onscreenObj.Keys("[Enter]");
    } else {
      onscreenObj.Keys("[Enter]");
    }
    if (ot) {
      Delay(500);
      onscreenObj.Keys(ot);
      onscreenObj.Keys("[Enter]");
      onscreenObj.Keys("[Enter]");
    } else {
      onscreenObj.Keys("[Enter]");
      onscreenObj.Keys("[Enter]");
    }
  } else {
    let onscreenObj = Sys.Desktop.ActiveWindow();
    onscreenObj.Keys("[Enter]");
    onscreenObj.Keys("[Enter]");
    onscreenObj.Keys("[Enter]");
  }
  Log.Message("Key order successfully !!");
}

function changeorder(no, side, editprice, editvolume, editpublish, expect) {
  if (expect != "Reject") {
    Log.Message("Start change order !!");
    if (editprice || editvolume || editpublish) {
      let onscreenObj = Sys.Desktop.ActiveWindow();
      onscreenObj.Keys("[Home]"); // go to change order
      if (editprice) {
        onscreenObj.Keys(editprice); // ket change price
        onscreenObj.Keys("[Enter]");
        onscreenObj.Keys("y");
      } else {
        onscreenObj.Keys("[Enter]");
        onscreenObj.Keys("[Enter]");
        Log.Message("skip edit price !!");
      }
      if (editvolume) {
        onscreenObj.Keys(editvolume); // key change volume
        onscreenObj.Keys("[Enter]"); // confirm change
      } else {
        onscreenObj.Keys("[Enter]"); // confirm change
        onscreenObj.Keys("[Enter]");
        Log.Message("skip edit volume !!");
      }
      if (editpublish) {
        onscreenObj.Keys(editpublish);
        onscreenObj.Keys("[Enter]");
      }
      onscreenObj.Keys("[Enter]");
      onscreenObj.Keys("[Enter]");
      onscreenObj.Keys("[Enter]");
      //if (editprice != "MKT") {
      //  if (side === "b") {
      //    Regions.OrderConfirmGrid9.Check(Regions.CreateRegionInfo(Aliases.javaw.MainFrame.ContentsPane.MainApplet.AViewOrderConfirmTScreen.AOrderConfirmTPanel1.OrderConfirmGrid, 1566, 3, 49, 63, false)); // check order status = OC
      //  } else {
      //    Regions.OrderConfirmGrid10.Check(Regions.CreateRegionInfo(Aliases.javaw.MainFrame.ContentsPane.MainApplet.AViewOrderConfirmTScreen.AOrderConfirmTPanel1.OrderConfirmGrid, 1564, 2, 52, 65, false)); // check order status = OC
      //  }
      //}
    } else {
      Log.Message("Change order skip !!");
    }
  } else {
    Log.Message("Reject change order skip !!");
  }
}

function sendreport(name) {
  let datadashoboard = {
    nameproduct: "iFisE_DRX",
    nametest: [
      {
        name: name,
        detailfail: resultdetailfail,
        detailerror: [],
        pass: resultdata.pass,
        fail: resultdata.fail,
        error: resultdata.error,
        time: "25s",
      },
    ],
  };
  const jsonString = JSON.stringify(datadashoboard);
  var response = sendtestresult(jsonString);
  Log.Message("data = " + resultdata.pass);
  Log.Message("response = " + response);
}

function Check_orderStatus(no, side, expect) {
  let result = true;
  if (expect) {
    let split_expect = expect.split(",");
    if (side === "b") {
      try {
        // order status
        switch (split_expect[0]) {
          case "O":
            {
              if (
                Regions.OrderConfirmGrid17.Check(
                  Regions.CreateRegionInfo(
                    Aliases.javaw.MainFrame.ContentsPane.MainApplet
                      .AViewOrderConfirmTScreen.AOrderConfirmTPanel1
                      .OrderConfirmGrid,
                    1560,
                    1,
                    49,
                    66,
                    false
                  )
                )
              ) {
                Log.Message("Check order status successfully !!");
              } else {
                result = false;
                resultdetailfail.push(
                  "order " + no + " order status not match"
                );
              }
            }
            break;
          case "OC":
            {
              if (
                Regions.OrderConfirmGrid15.Check(
                  Regions.CreateRegionInfo(
                    Aliases.javaw.MainFrame.ContentsPane.MainApplet
                      .AViewOrderConfirmTScreen.AOrderConfirmTPanel1
                      .OrderConfirmGrid,
                    1563,
                    1,
                    60,
                    68,
                    false
                  )
                )
              ) {
                Log.Message("Check order status successfully !!");
              } else {
                result = false;
                resultdetailfail.push(
                  "order " + no + " order status not match"
                );
                Log.Message("Check order status fail !!");
              }
            } // B_OC
            break;
          case "Reject":
            Log.Message("expect = Reject, Check order status skip !!");
            break;
          case "M":
            {
              if (
                Regions.OrderConfirmGrid22.Check(
                  Regions.CreateRegionInfo(
                    Aliases.javaw.MainFrame.ContentsPane.MainApplet
                      .AViewOrderConfirmTScreen.AOrderConfirmTPanel1
                      .OrderConfirmGrid,
                    1560,
                    3,
                    49,
                    63,
                    false
                  )
                )
              ) {
                Log.Message("Check order status successfully !!");
              } else {
                result = false;
                resultdetailfail.push(
                  "order " + no + " order status not match"
                );
                Log.Message("Check order status fail !!");
              }
            }
            break;
          default:
            Log.Message("no expect, Check order status skip !!");
        }
      } catch (e) {
        Log.Error("An error occurred during the region check: " + e.message);
        result = false;
      }
      try {
        // quote
        switch (split_expect[1]) {
          case "Y":
            {
              if (
                Regions.OrderConfirmGrid16.Check(
                  Regions.CreateRegionInfo(
                    Aliases.javaw.MainFrame.ContentsPane.MainApplet
                      .AViewOrderConfirmTScreen.AOrderConfirmTPanel1
                      .OrderConfirmGrid,
                    1792,
                    3,
                    46,
                    64,
                    false
                  )
                )
              ) {
                Log.Message("Check quote status successfully !!");
              } else {
                result = false;
                resultdetailfail.push(
                  "order " + no + " quote status not match"
                );
                Log.Message("Check quote fail !!");
              }
            } // B_QY
            break;
          default:
            Log.Message("no quote expect, Check quote status skip !!");
        }
      } catch (e) {
        Log.Error("An error occurred during the region check: " + e.message);
        result = false;
      }
      let mainApplet = Aliases.javaw.MainFrame.ContentsPane.MainApplet;
      mainApplet.AViewOrderConfirmTScreen.AOrderConfirmTPanel1.OrderConfirmGrid.Drag(
        1741,
        49,
        -1500,
        -7
      ); // Drag to con
      try {
        // condition
        switch (split_expect[2]) {
          case "I":
            {
              if (
                Regions.OrderConfirmGrid18.Check(
                  Regions.CreateRegionInfo(
                    Aliases.javaw.MainFrame.ContentsPane.MainApplet
                      .AViewOrderConfirmTScreen.AOrderConfirmTPanel1
                      .OrderConfirmGrid,
                    1891,
                    0,
                    111,
                    67,
                    false
                  )
                )
              ) {
                Log.Message("Check condition status successfully !!");
              } else {
                result = false;
                resultdetailfail.push(
                  "order " + no + " condition status not match"
                );
                Log.Message("Check condition fail !!");
              }
            } // BB_I
            break;
          case "F":
            {
              if (
                Regions.OrderConfirmGrid19.Check(
                  Regions.CreateRegionInfo(
                    Aliases.javaw.MainFrame.ContentsPane.MainApplet
                      .AViewOrderConfirmTScreen.AOrderConfirmTPanel1
                      .OrderConfirmGrid,
                    1894,
                    0,
                    107,
                    65,
                    false
                  )
                )
              ) {
                Log.Message("Check condition status successfully !!");
              } else {
                result = false;
                resultdetailfail.push(
                  "order " + no + " condition status not match"
                );
                Log.Message("Check condition fail !!");
              }
            }
            break;
          case "C":
            {
              if (
                Regions.OrderConfirmGrid20.Check(
                  Regions.CreateRegionInfo(
                    Aliases.javaw.MainFrame.ContentsPane.MainApplet
                      .AViewOrderConfirmTScreen.AOrderConfirmTPanel1
                      .OrderConfirmGrid,
                    1890,
                    1,
                    115,
                    66,
                    false
                  )
                )
              ) {
                Log.Message("Check condition status successfully !!");
              } else {
                result = false;
                resultdetailfail.push(
                  "order " + no + " condition status not match"
                );
                Log.Message("Check condition fail !!");
              }
            }
            break;
          case "D":
            Regions.OrderConfirmGrid21.Check(
              Regions.CreateRegionInfo(
                Aliases.javaw.MainFrame.ContentsPane.MainApplet
                  .AViewOrderConfirmTScreen.AOrderConfirmTPanel1
                  .OrderConfirmGrid,
                1890,
                2,
                110,
                66,
                false
              )
            );
            break;
          default:
            Log.Message("no condition expect, Check condition status skip !!");
        }
      } catch (e) {
        Log.Error("An error occurred during the region check: " + e.message);
        result = false;
      }
    }
  }
  if (result) {
    Log.Message("PASS");
    resultdata.pass = resultdata.pass + 1;
    result = true;
  } else {
    Log.Message("FAIL");
    resultdata.fail = resultdata.fail + 1;
    result = true;
  }
}

function getFloor(side) {
  if (side === "b") {
    var region = Regions.CreateRegionInfo(
      Aliases.javaw.MainFrame.ContentsPane.MainApplet.AOrderEntryBuyScreen
        .AOrderEntryPanel1,
      108,
      70,
      56,
      34,
      false
    );
  } else {
    var region = Regions.CreateRegionInfo(
      Aliases.javaw.MainFrame.ContentsPane.MainApplet.AOrderEntrySellScreen
        .AOrderEntryPanel1,
      106,
      70,
      62,
      32,
      false
    );
  }
  var pic = region.Picture();
  Log.Picture(pic, "image floor price");
  pic.SaveToFile(floorFile);

  const b = getByteFromFile(floorFile);
  const aqHttpResponse = callApi(b, "FLOOR");
  deleteFile(floorFile);
  const obj = JSON.parse(aqHttpResponse.Text);

  var price = invalid;
  switch (aqString.Compare(obj.result, "true", false)) {
    case 0:
      price = cleanNumber(obj.text).split("\n");
      break;
    default:
      break;
  }
  return price;
}

function getByteFromFile(file) {
  f = aqFile.OpenBinaryFile(file, aqFile.faRead);
  var b = f.ReadBytes();
  f.Close();
  return b;
}

function deleteFile(file) {
  aqFile.Delete(file);
}
function callApi(b, p) {
  var aqHttpRequest = aqHttp.CreatePostRequest(url);
  aqHttpRequest.SetHeader("Content-Type", "image/png");
  aqHttpRequest.SetHeader("processing", p);
  var aqHttpResponse = aqHttpRequest.Send(b);
  httpResponse(aqHttpResponse);
  return aqHttpResponse;
}

function sendtestresult(requestBody) {
  var aqHttpRequest = aqHttp.CreatePostRequest(url_dashboard);
  aqHttpRequest.SetHeader("Content-Type", "application/json");
  var aqHttpResponse = aqHttpRequest.Send(requestBody);
  Log.Message(requestBody);
  //httpResponse(aqHttpResponse);
  return aqHttpResponse;
}
function httpResponse(aqHttpResponse) {
  // Log.Message(aqHttpResponse.AllHeaders); // All headers
  // Log.Message(aqHttpResponse.GetHeader("Content-Type")); // A specific header
  // Log.Message(aqHttpResponse.StatusCode); // A status code
  // Log.Message(aqHttpResponse.StatusText); // A status text
  Log.Message(aqHttpResponse.Text); // A response body
}

function cleanNumber(text) {
  const newtext = text.replace(",", "");
  return newtext;
}

function keyfloor() {
  var onscreenObj = Sys.Desktop.ActiveWindow();
  onscreenObj.Keys("8"); // ctrl+b btn
}

function ScreenShot_F2(symbol) {
  if (symbol_tmp != symbol) {
    let onscreenObj = Sys.Desktop.ActiveWindow();
    let javaw = Aliases.javaw;
    let mainApplet = javaw.MainFrame.ContentsPane.MainApplet;
    mainApplet.Keys("[F2]");
    mainApplet.BInputScreen.InputLinePanel1.filterTextField.filterTextField.Keys(
      symbol
    );
    onscreenObj.Keys("[Enter]");
    var pic_f2 = Regions.CreateRegionInfo(
      Aliases.javaw.MainFrame.ContentsPane.MainApplet,
      0,
      2,
      1920,
      1005,
      false
    );
    var pic = pic_f2.Picture();
    let dd = today.getDate();
    let mm = Number(today.getMonth() + 1);
    if (String(dd).length === 1) {
      dd = "0" + dd;
    }
    if (String(mm).length === 1) {
      mm = "0" + mm;
    }
    let datepic = dd + "_" + mm + "_" + today.getFullYear();
    let pic_path =
      "D:\\dev_cke\\log\\2Open1\\Log_" +
      datepic +
      "\\MarketByPrice-Pic\\" +
      symbol +
      ".png";
    Log.Message(pic_path);
    pic.SaveToFile(pic_path);
    symbol_tmp = symbol;
  } else {
    symbol_tmp = symbol;
  }
}

function ScreenShot_Vieworder() {
  let onscreenObj = Sys.Desktop.ActiveWindow();
  let javaw = Aliases.javaw;
  let panel = javaw.LoginDialog.ContentsPane;
  let mainFrame = javaw.MainFrame;
  let mainApplet = mainFrame.ContentsPane.MainApplet;
  let AViewOrderConfirmTScreen = mainApplet.AViewOrderConfirmTScreen;
  let AOrderConfirmTPanel = AViewOrderConfirmTScreen.AOrderConfirmTPanel1;

  for (let i = 0; i < noacc.length; i++) {
    Log.Message("dataaaaaaaaaaaa" + noacc[i].account + "/" + noacc[i].no);
    onscreenObj.Keys("[PrtSc]");
    onscreenObj.Keys(noacc[i].account);
    onscreenObj.Keys("[Enter]");
    onscreenObj.Keys("^b");
    for (let y = 0; y < Math.ceil(noacc[i].no / 7); y++) {
      var Vieworder = Regions.CreateRegionInfo(
        Aliases.javaw.MainFrame.ContentsPane.MainApplet,
        0,
        2,
        1920,
        1005,
        true
      );
      var pic = Vieworder.Picture();
      const today = new Date();
      let dd = today.getDate();
      if (String(dd).length === 1) {
        let datepic =
          "0" +
          today.getDate() +
          "_" +
          Number(today.getMonth() + 1) +
          "_" +
          today.getFullYear();
        Log.Message("dd" + datepic);
        const dirpic = "D:\\dev_cke\\log\\2Open1\\";
        const dirlog = "Log_" + datepic + "\\Vieworder-Pic";
        const dirdatepic =
          dirpic +
          dirlog +
          "\\" +
          noacc[i].account +
          y +
          "_S-Vieworder-Pic.png";
        pic.SaveToFile(dirdatepic);
        Log.Message(dirdatepic);
      } else {
        let datepic =
          today.getDate() +
          "_" +
          Number(today.getMonth() + 1) +
          "_" +
          today.getFullYear();
        Log.Message("dd" + datepic);
        const dirpic = "D:\\dev_cke\\log\\2Open1\\";
        const dirlog = "Log_" + datepic + "\\Vieworder-Pic";
        const dirdatepic =
          dirpic +
          dirlog +
          "\\" +
          noacc[i].account +
          y +
          "_S-Vieworder-Pic.png";
        pic.SaveToFile(dirdatepic);
        Log.Message(dirdatepic);
      }
      Aliases.javaw.MainFrame.ContentsPane.MainApplet.AViewOrderConfirmTScreen.AOrderConfirmTPanel1.OrderConfirmGrid.Drag(
        1531,
        50,
        -1371,
        10
      );
      var Vieworder2 = Regions.CreateRegionInfo(
        Aliases.javaw.MainFrame.ContentsPane.MainApplet,
        0,
        2,
        1920,
        1005,
        true
      );
      var pic2 = Vieworder2.Picture();
      if (String(dd).length === 1) {
        let datepic =
          "0" +
          today.getDate() +
          "_" +
          Number(today.getMonth() + 1) +
          "_" +
          today.getFullYear();
        Log.Message("dd" + datepic);
        const dirpic = "D:\\dev_cke\\log\\2Open1\\";
        const dirlog = "Log_" + datepic + "\\Vieworder-Pic";
        const dirdatepic =
          dirpic +
          dirlog +
          "\\" +
          noacc[i].account +
          y +
          "_E-Vieworder-Pic.png";
        pic2.SaveToFile(dirdatepic);
        Log.Message(dirdatepic);
      } else {
        let datepic =
          today.getDate() +
          "_" +
          Number(today.getMonth() + 1) +
          "_" +
          today.getFullYear();
        Log.Message("dd" + datepic);
        const dirpic = "D:\\dev_cke\\log\\2Open1\\";
        const dirlog = "Log_" + datepic + "\\Vieworder-Pic";
        const dirdatepic =
          dirpic +
          dirlog +
          "\\" +
          noacc[i].account +
          y +
          "_E-Vieworder-Pic.png";
        pic2.SaveToFile(dirdatepic);
        Log.Message(dirdatepic);
      }
      Aliases.javaw.MainFrame.ContentsPane.MainApplet.AViewOrderConfirmTScreen.AOrderConfirmTPanel1.OrderConfirmGrid.Drag(
        1310,
        151,
        1536,
        4
      );
      AViewOrderConfirmTScreen.Panel.NextButton.Click(37, 15);
    }
  }
}

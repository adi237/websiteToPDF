const fs = require('fs'); 
const shell = require('shelljs');
const puppeteer = require('puppeteer');

const GIT_PDF_REPO_FOLDER_PATH = "./git_pdf_repo";

(async () => {

  //Cleanup PDF folder
  if (shell.exec('rm -rf ./pdf/*').code !== 0) {
    shell.echo('Error While deleting pdf directory contents');
  }
  else
    console.log("pdf directory cleaned");

  //Init Variables
  let subsectionCounter=0;
  let tempArr;
  let directoryName;
  let filename;
  let path;
  let subsectionPath;

  const baseUrl = "https://docs.oracle.com/en-us/iaas/api/#/";
  const browser = await puppeteer.launch({headless: true, defaultViewport: {width: 1026, height: 826}});
  const page = await browser.newPage();
  await page.goto(baseUrl, {waitUntil: 'networkidle2'});
  
  //Fetch the list items of the API Menu
  let li_Elements = await page.$$("nav.vl-sidebar-left > div > ul > li");
  //console.log(li_Elements.length); -- Usually around 64

  //Loop over each item in the API menu.
  for(let index=1;index<li_Elements.length;index++){

      //Create Directory under the PDF folder based on list item name. For Eg: APIGateway, Alerts etc
        directoryName = await li_Elements[index].evaluate(node => node.innerText);
        directoryName = directoryName.replace(/ /g,"").replace(/\(/g,"").replace(/\)/g,"");
        path = "./pdf/" + directoryName;

        console.log("directoryName: " + path);
        
        if (shell.exec('mkdir ' + path).code !== 0) {
          shell.echo('Error');
          console.log("Probably Directory Already exists");
        }
        else
          console.log("directory created");

      //click to expand the menu item.
        li_Elements[index].$$eval("a", function(elements){ 
          console.log(elements.length);
          elements.forEach(e => e.click());
        });

      await page.waitForTimeout(5000);

      //Create the home links page as well; eg: iaas.ashubrn.oracle.com etc
        await page.emulateMediaType('screen');
        await page.pdf({path: path + "/" + directoryName + "_API_HOME.pdf", printBackground: true, margin: {top: "30px",right:"30px",bottom:"30px",left:"30px"}});

      //refresh the li_elements as dynamic elements were added when the menu item was expanded.
        li_Elements = await page.$$("nav.vl-sidebar-left > div > ul > li");

      //Expand all subsections
        li_Elements[index].$$eval("button",function(elements){ 
        elements.forEach((e,i) => {
          if(i>0)
          e.click();
        });
      });

      await page.waitForTimeout(5000);

      //refresh the li_elements as dynamic elements were added when the menu item was expanded.
        li_Elements = await page.$$("nav.vl-sidebar-left > div > ul > li");
      
      //Get All links of the menu item.
        //tempArr = await li_Elements[index].$$("a:not(.uk-position-relative)");
      tempArr = await li_Elements[index].$$("a");

      console.log("   Links in subsection: " + tempArr.length);

      //Loop over the links and create pdf of each page.
        for(var innerIndex=2;innerIndex<tempArr.length;innerIndex++){

          //Check whether the link is a subsection header or a page with information.
            var subsectionHeader = await tempArr[innerIndex].evaluate(node => node.classList);
            filename = await tempArr[innerIndex].evaluate(node => node.innerText);
            filename = filename.replace(/ /g,"").replace(/\(/g,"").replace(/\)/g,"");

          //if link is just a subsection header then create a dir and save the name of the directory.
            if(Object.values(subsectionHeader).indexOf("uk-position-relative") > -1)
            {
              subsectionPath = filename;
              if (shell.exec('mkdir ' + path + "/" + subsectionPath).code !== 0) {
                shell.echo('Error');
              }
              else{
                console.log("directory created");
              }

              continue;
            }

          //Just for final count of how many files were created.
            subsectionCounter++;
          
          //Fetch the url for the link and page.goto.
            var href = await tempArr[innerIndex].evaluate(node => node.href);

            await page.goto(href, {waitUntil: 'networkidle2'});
            console.log("   going to " + href);

          //Write pdf file in the appropriate subsection folder.
            console.log("   Writing FileName: "+filename);

            await page.emulateMediaType('screen');
            console.log("creating file at: " + path + "/" + filename + ".pdf");
            await page.pdf({path: path + "/" + subsectionPath + "/" + filename + ".pdf", printBackground: true, margin: {top: "30px",right:"30px",bottom:"30px",left:"30px"}});
        }

  }

  console.log("----------------------------------------");
  console.log("Total Sections: " + li_Elements.length);
  console.log("Total PDFs created: " + subsectionCounter);
  console.log("----------------------------------------");

  //Remove Old Zip and create new Zip
  if (shell.exec('rm *.zip').code !== 0) {
    shell.echo('Error');
  }
  else{
    console.log("zip cleaned");
  }

  if (shell.exec('zip -q -r OCI_APIS_'+ new Date().toDateString().replace(/ /g,"_") +'.zip ./pdf').code !== 0) {
    shell.echo('Error');
  }
  else{
    console.log("zip created");
  }

  uploadToGit();
  await browser.close();
})();


function uploadToGit(){
    //Cleanup git repo folder
    if (shell.exec(`rm -rf ${GIT_PDF_REPO_FOLDER_PATH}`).code !== 0) {
      shell.echo('Error While deleting pdf repo contents');
    }
    else
      shell.echo("pdf repo cleaned");

    
    //Cleanup subgitfolder
    shell.exec(`git rm --cached ${GIT_PDF_REPO_FOLDER_PATH}`);
    shell.exec(`rm -rf ${GIT_PDF_REPO_FOLDER_PATH}`);
    shell.exec(`rm -rf .git/modules/${GIT_PDF_REPO_FOLDER_PATH.replace(".","")}`)

    //clonefresh copy of repo
    shell.exec(`git submodule add https://github.com/adi237/oic-rest-apis-pdf ${GIT_PDF_REPO_FOLDER_PATH}`);

    //before zipping move all other zips to the archive folder.
    shell.exec(`mv ${GIT_PDF_REPO_FOLDER_PATH}/*.zip ./archive`);

    //zip the folder and create the zip in the git repo
    shell.exec(`zip ${GIT_PDF_REPO_FOLDER_PATH}/OCI_APIs_PDF_${new Date().toISOString()}.zip ./pdf`);
    
    shell.exec(`cd ${GIT_PDF_REPO_FOLDER_PATH}`);

    //git add commit and push.
    shell.exec(`git add *`);
    shell.exec(`git commit -m "Adding new Zip - ${new Date()}"`);
    shell.exec(`git push origin main`);
}
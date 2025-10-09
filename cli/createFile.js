#!/usr/bin/env node

const readline = require("readline");
const fs = require("fs");
const clc = require("cli-color");

function createFolder(folderName) {
	const defaultPath = `./src/components/modules/${folderName}`;
	const initialFile = `./src/pages`;

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	let content = `extends ./_layout/_default.pug
	\nblock var
	- var title = ''
	- var bodyClass = ''
	\nblock main`;

	const defaultContent_1 = folderName => {
		content += `\n\tinclude ../components/modules/${folderName}/${folderName}`;
		return content;
	};
	const defaultContent_2 = (folderName, type) => {
		let mergeContent = "";
		mergeContent = `${content}\n\tinclude ../components/modules/${folderName}/${type}/${folderName}${type}`;
		return mergeContent;
	};
	const defaultContent_3 = numSections => {
		for (let i = 1; i <= numSections; i++) {
			content += `\n\tinclude ../components/modules/${folderName}/${folderName}-${i}/${folderName}-${i}`;
		}
		return content;
	};

	console.log(
		clc.xterm(165).italic(`🤌 ➝ Please select an option:`),

		clc.xterm(36)(`\n    1. `) +
			clc.xterm(15)(`Single folder and files (create 📁 `) +
			clc.xterm(208)(`${folderName}`) +
			clc.xterm(15)(` contain`) +
			clc.xterm(201)(` ${folderName}.sass `) +
			clc.xterm(15)(`and`) +
			clc.xterm(201)(` ${folderName}.pug)`),

		clc.xterm(36)(`\n    2. `) +
			clc.xterm(15)(`List folder and files (create 📁 `) +
			clc.xterm(208)(`List`) +
			clc.xterm(15)(` and`) +
			clc.xterm(208)(`  📁 Detail`) +
			clc.xterm(15)(`, each contain `) +
			clc.xterm(201)(`${folderName}.sass`) +
			clc.xterm(15)(` and `) +
			clc.xterm(201)(`${folderName}.pug`),

		clc.xterm(36)(`\n    3. `) +
			clc.xterm(15)(`Multiple sections (create `) +
			clc.xterm(208)(`${folderName}-1`) +
			clc.xterm(15)(", ") +
			clc.xterm(208)(`${folderName}-2`) +
			clc.xterm(15)(`, ... 📁, each containing `) +
			clc.xterm(201)(`${folderName}-1.sass`) +
			clc.xterm(15)(`,`) +
			clc.xterm(201)(`${folderName}-1.pug`) +
			clc.xterm(15)(`, etc.)`)
	);
	rl.on("line", answer => {
		if (answer === "1") {
			// Create initial file
			fs.writeFileSync(
				`${initialFile}/${folderName}.pug`,
				defaultContent_1(folderName)
			);
			fs.mkdirSync(defaultPath);
			fs.writeFileSync(`${defaultPath}/${folderName}.pug`, "");
			fs.writeFileSync(`${defaultPath}/${folderName}.sass`, "");
			rl.close();
		} else if (answer === "2") {
			// Create initial file
			fs.writeFileSync(
				`${initialFile}/${folderName}List.pug`,
				defaultContent_2(folderName, "List")
			);
			fs.writeFileSync(
				`${initialFile}/${folderName}Detail.pug`,
				defaultContent_2(folderName, "Detail")
			);
			fs.mkdirSync(defaultPath);
			fs.mkdirSync(`${defaultPath}/List`);
			fs.writeFileSync(`${defaultPath}/List/${folderName}List.pug`, "");
			fs.writeFileSync(`${defaultPath}/List/${folderName}List.sass`, "");
			fs.mkdirSync(`${defaultPath}/Detail`);
			fs.writeFileSync(
				`${defaultPath}/Detail/${folderName}Detail.pug`,
				""
			);
			fs.writeFileSync(
				`${defaultPath}/Detail/${folderName}Detail.sass`,
				""
			);
			rl.close();
		} else if (answer === "3") {
			console.log(
				clc.blueBright(
					"Enter the number of sections you want to create:"
				)
			);
			rl.on("line", numberOfSections => {
				// Create initial file
				const numSections = parseInt(numberOfSections, 10);
				fs.writeFileSync(
					`${initialFile}/${folderName}.pug`,
					defaultContent_3(numberOfSections)
				);
				fs.mkdirSync(defaultPath);
				if (isNaN(numSections)) {
					console.log(
						clc.redBright(
							"Invalid input. Please enter a valid number."
						)
					);
					rl.close();
				} else {
					for (let i = 1; i <= numSections; i++) {
						const sectionPath = `${defaultPath}/${folderName}-${i}`;
						fs.mkdirSync(sectionPath);
						fs.writeFileSync(
							`${sectionPath}/${folderName}-${i}.pug`,
							""
						);
						fs.writeFileSync(
							`${sectionPath}/${folderName}-${i}.sass`,
							""
						);
					}
					rl.close();
				}
			});
		}
	});
}
console.log("-----------------------");
console.log(clc.greenBright("Running createFolder..."));
console.log("-----------------------");
const folderName = process.argv[2];
createFolder(folderName);

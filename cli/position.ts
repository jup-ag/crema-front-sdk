/* eslint-disable @typescript-eslint/no-explicit-any */
import { getATAAddress } from "@saberhq/token-utils";
import type { PublicKey } from "@solana/web3.js";
import { printTable } from "console-table-printer";
import type Decimal from "decimal.js";
import * as inquire from "inquirer";
import _ from "lodash";
import { exit } from "process";
import invariant from "tiny-invariant";

import { calculateTokenAmount } from "../src";
import {
  loadSwapPair,
  printObjectJSON,
  printObjectTable,
  swapPairPositions,
} from ".";

export async function mintPosition({
  pairKey,
  lowerPrice,
  upperPrice,
  amountA,
  amountB,
  slid,
}: {
  pairKey: PublicKey;
  lowerPrice: Decimal;
  upperPrice: Decimal;
  amountA: Decimal | null;
  amountB: Decimal | null;
  slid: Decimal;
}) {
  const swap = await loadSwapPair(pairKey);
  const { lowerTick, upperTick } = swap.calculateEffectivTick(
    lowerPrice,
    upperPrice
  );

  const liquityResult = swap.calculateLiquityWithSlid({
    lowerTick,
    upperTick,
    amountA,
    amountB,
    slid,
  });

  const userTokenA = await getATAAddress({
    mint: swap.tokenSwapInfo.tokenAMint,
    owner: swap.provider.wallet.publicKey,
  });
  const userTokenB = await getATAAddress({
    mint: swap.tokenSwapInfo.tokenBMint,
    owner: swap.provider.wallet.publicKey,
  });

  const res = await swap.mintPosition(
    userTokenA,
    userTokenB,
    lowerTick,
    upperTick,
    liquityResult.liquity,
    liquityResult.maximumAmountA,
    liquityResult.maximumAmountB
  );

  printObjectTable({
    swap: pairKey,
    currentPrice: swap.uiPrice(),
    lowerPrice,
    upperPrice,
    positionId: res.positionId,
    positionAccount: res.positionAccount,
    positionsKey: res.positionsKey,
    amountA: swap.tokenAAmount(liquityResult.amountA),
    amountB: swap.tokenBAmount(liquityResult.amountB),
    maximumAmountA: swap.tokenAAmount(liquityResult.maximumAmountA),
    maximumAmountB: swap.tokenBAmount(liquityResult.maximumAmountB),
    minimumAmountA: swap.tokenAAmount(liquityResult.minimumAmountA),
    minimumAmountB: swap.tokenBAmount(liquityResult.minimumAmountB),
  });

  const getConfirm = await inquire.prompt({
    type: "confirm",
    name: "confirm",
    prefix: "",
    message:
      "The above table is the position info and the cost expect, confirm it ?",
  });

  if (getConfirm.confirm) {
    const receipt = await res.tx.confirm();
    printObjectJSON({
      signature: receipt.signature.toString(),
      cmpuateUnits: receipt.computeUnits,
      positionInfo: {
        swap: pairKey,
        ..._.omit(res, "tx"),
      },
    });
  } else {
    exit(0);
  }
}

export async function increaseLiquity({
  pairKey,
  positionId,
  positionAccount,
  amountA,
  amountB,
  slid,
}: {
  pairKey: PublicKey;
  positionId: PublicKey;
  positionAccount: PublicKey | null;
  amountA: Decimal | null;
  amountB: Decimal | null;
  slid: Decimal;
}) {
  const swap = await loadSwapPair(pairKey);
  const position = swap.getPositionInfo(positionId);
  invariant(position !== undefined, "The position not found");
  const userTokenA = await getATAAddress({
    mint: swap.tokenSwapInfo.tokenAMint,
    owner: swap.provider.wallet.publicKey,
  });
  const userTokenB = await getATAAddress({
    mint: swap.tokenSwapInfo.tokenBMint,
    owner: swap.provider.wallet.publicKey,
  });

  const liquityResult = swap.calculateLiquityWithSlid({
    lowerTick: position.lowerTick,
    upperTick: position.upperTick,
    amountA,
    amountB,
    slid,
  });

  printObjectTable({
    swap: pairKey,
    positionId: position.positionId,
    currentPrice: swap.uiPrice(),
    lowerPrice: swap.tick2UiPrice(position.lowerTick),
    upperPrice: swap.tick2UiPrice(position.upperTick),
    amountA: swap.tokenAAmount(liquityResult.amountA),
    amountB: swap.tokenBAmount(liquityResult.amountB),
    maximumAmountA: swap.tokenAAmount(liquityResult.maximumAmountA),
    maximumAmountB: swap.tokenBAmount(liquityResult.maximumAmountB),
    minimumAmountA: swap.tokenAAmount(liquityResult.minimumAmountA),
    minimumAmountB: swap.tokenBAmount(liquityResult.minimumAmountB),
  });
  const getConfirm = await inquire.prompt({
    type: "confirm",
    name: "confirm",
    prefix: "",
    message:
      "The above table is the position info and the cost expect, confirm it ?",
  });
  const tx = await swap.increaseLiquity(
    positionId,
    userTokenA,
    userTokenB,
    liquityResult.liquity,
    liquityResult.maximumAmountA,
    liquityResult.maximumAmountB,
    positionAccount
  );

  if (getConfirm.confirm) {
    const receipt = await tx.confirm();
    printObjectJSON({
      signature: receipt.signature.toString(),
      cmpuateUnits: receipt.computeUnits,
      message: "incease liquity success",
    });
  } else {
    exit(0);
  }
}

export async function decreaseLiquity({
  pairKey,
  positionId,
  positionAccount,
  percent,
  slid,
}: {
  pairKey: PublicKey;
  positionId: PublicKey;
  positionAccount: PublicKey | null;
  percent: Decimal;
  slid: Decimal;
}) {
  invariant(
    percent.greaterThan(0) && percent.lessThanOrEqualTo(1),
    `Invalid pencentage:${percent.toString()}`
  );
  const swap = await loadSwapPair(pairKey);
  const position = swap.getPositionInfo(positionId);
  invariant(position !== undefined, "The position not found");
  const userTokenA = await getATAAddress({
    mint: swap.tokenSwapInfo.tokenAMint,
    owner: swap.provider.wallet.publicKey,
  });
  const userTokenB = await getATAAddress({
    mint: swap.tokenSwapInfo.tokenBMint,
    owner: swap.provider.wallet.publicKey,
  });

  const positionValue = swap.calculatePositionValueWithSlid(
    positionId,
    percent,
    slid
  );

  printObjectTable({
    swap: pairKey,
    positionId: position.positionId,
    currentPrice: swap.uiPrice(),
    lowerPrice: swap.tick2UiPrice(position.lowerTick),
    upperPrice: swap.tick2UiPrice(position.upperTick),
    amountA: swap.tokenAAmount(positionValue.amountA),
    amountB: swap.tokenBAmount(positionValue.amountB),
    maximumAmountA: swap.tokenAAmount(positionValue.maxAmountA),
    maximumAmountB: swap.tokenBAmount(positionValue.maxAmountB),
    minimumAmountA: swap.tokenAAmount(positionValue.minAmountA),
    minimumAmountB: swap.tokenBAmount(positionValue.minAmountB),
  });
  const getConfirm = await inquire.prompt({
    type: "confirm",
    name: "confirm",
    prefix: "",
    message:
      "The above table is the position info and expect token you will receive, confirm it ?",
  });

  const tx = await swap.decreaseLiquity(
    positionId,
    userTokenA,
    userTokenB,
    positionValue.liquity,
    positionValue.minAmountA,
    positionValue.minAmountB,
    positionAccount
  );

  if (getConfirm.confirm) {
    const receipt = await tx.confirm();
    printObjectJSON({
      signature: receipt.signature.toString(),
      cmpuateUnits: receipt.computeUnits,
      message: "decrease liquity success",
    });
  } else {
    exit(0);
  }
}

export async function fetchPostions({
  pairKey,
  owner,
}: {
  pairKey: PublicKey;
  owner: PublicKey | undefined | null;
}) {
  const swap = await loadSwapPair(pairKey);

  if (owner === undefined) {
    const positions = swapPairPositions(swap);
    printTable(positions);
  } else {
    owner = owner !== null ? owner : swap.provider.wallet.publicKey;
    const positions = await swap.getUserPositions(owner);
    const list: any[] = [];
    positions.forEach((v) => {
      const amount = calculateTokenAmount(
        v.lowerTick,
        v.upperTick,
        v.liquity,
        swap.tokenSwapInfo.currentSqrtPrice
      );
      list.push({
        ...v,
        amountA: swap.tokenAAmount(amount.amountA),
        amountB: swap.tokenBAmount(amount.amountB),
      });
    });
    printTable(list);
  }
}

export async function claim({
  pairKey,
  positionId,
}: {
  pairKey: PublicKey;
  positionId: PublicKey;
}) {
  const swap = await loadSwapPair(pairKey);
  const userTokenA = await getATAAddress({
    mint: swap.tokenSwapInfo.tokenAMint,
    owner: swap.provider.wallet.publicKey,
  });
  const userTokenB = await getATAAddress({
    mint: swap.tokenSwapInfo.tokenBMint,
    owner: swap.provider.wallet.publicKey,
  });
  const feeAmount = swap.preClaim(positionId);

  printObjectTable({
    pendingFeeA: swap.tokenAAmount(feeAmount.amountA),
    pendingFeeB: swap.tokenBAmount(feeAmount.amountB),
  });
  const getConfirm = await inquire.prompt({
    type: "confirm",
    name: "confirm",
    prefix: "",
    message:
      "The above table is the expect  pending fee you will receive, claim it ?",
  });

  const tx = await swap.claim(positionId, userTokenA, userTokenB, positionId);

  if (getConfirm.confirm) {
    const receipt = await tx.confirm();
    printObjectJSON({
      signature: receipt.signature.toString(),
      cmpuateUnits: receipt.computeUnits,
      message: "claim fee success",
    });
  } else {
    exit(0);
  }
}

export async function fetchPostion({
  pairKey,
  positionId,
}: {
  pairKey: PublicKey;
  positionId: PublicKey;
}) {
  const swap = await loadSwapPair(pairKey);
  const position = swap.getPositionInfo(positionId);
  if (position === undefined) {
    console.log(`The position:${positionId.toBase58()} not found`);
    exit(0);
  }
  const amount = calculateTokenAmount(
    position.lowerTick,
    position.upperTick,
    position.liquity,
    swap.tokenSwapInfo.currentSqrtPrice
  );
  const feeAmount = swap.preClaim(positionId);

  printObjectTable({
    ...position,
    amountA: swap.tokenAAmount(amount.amountA),
    amountB: swap.tokenBAmount(amount.amountB),
    pendingFeeA: swap.tokenAAmount(feeAmount.amountA),
    pendingFeeB: swap.tokenBAmount(feeAmount.amountB),
  });
}
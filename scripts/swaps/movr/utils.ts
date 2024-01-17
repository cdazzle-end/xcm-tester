export function calculateSwapAmountRouterFormula(input: bigint, inputReserve: bigint, outputReserve: bigint, slippageTolerance: number, fee: number): bigint{
    // console.log(`Input: ${input}`)
    // const testFee = 25
    // const testSlip = 100
    
    const feeMultiplier = BigInt(10000) - BigInt(fee)
    const slipMultiplier = BigInt(10000) - BigInt(slippageTolerance)

    const amountInWithFee = input * feeMultiplier
    const numerator = amountInWithFee * outputReserve
    const denominator = (inputReserve * BigInt(10000)) + amountInWithFee

    const formulatAmountOut = numerator / denominator
    // console.log(`Formula Amount Out: ${formulatAmountOut}`)

    const amountInWithSlippage = input * slipMultiplier
    const slipNumerator = amountInWithSlippage * outputReserve
    const slipDenominator = (inputReserve * BigInt(10000)) + amountInWithSlippage

    const slippageAmountOut = slipNumerator / slipDenominator
    // console.log(`Slippage Amount Out: ${slippageAmountOut}`)

    const slippageToleranceTest = 0.01
    const slippageNumerator = BigInt(Math.round(slippageToleranceTest * 100))
    const slippageDenominator = BigInt(100)
    let amountOutIdeal: bigint = (outputReserve * input) / (inputReserve + input)
    // console.log(`Amount out ideal: ${amountOutIdeal}`)

    let slippageAmount = (amountOutIdeal * slippageNumerator) / slippageDenominator;
    // console.log(`Slippage Amount: ${slippageAmount}`)

    let amountOutMinusSlippage = amountOutIdeal  - slippageAmount
    // console.log(`Original Calculated Amount Out: ${amountOutMinusSlippage}`)
    // if(amountOutMinusSlippage != slippageAmountOut){
    //     throw new Error("Calculated amount out and Router formula amount out do not match (slippage)")
    // }
    return slippageAmountOut
}